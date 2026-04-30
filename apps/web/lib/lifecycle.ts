import { sql } from '@/lib/db'
import { tryFireCompletionWebhook } from '@/lib/webhook'

export type SurveyLifecycle = {
  status?: string | null
  response_count?: number | null
  max_responses?: number | null
  expires_at?: string | null
}

export function getSurveyClosureReason(survey: SurveyLifecycle) {
  // Order matters. Both 'full' and 'expired' are checked BEFORE the generic 'closed'
  // fallback so auto-closed surveys don't collapse to 'closed'. Within those two,
  // 'full' is checked first because response_count is monotonic (it never decreases
  // once max is hit) — if a survey was closed by max_responses, that cause is stable
  // forever. Wall-clock expiry, in contrast, can become true *after* a survey was
  // already closed for a different reason; checking it first would cause a max-closed
  // survey to drift to 'expired' once expires_at passes. Manual close (PATCH) clears
  // expires_at, so it never trips the 'expired' branch.
  if (
    typeof survey.max_responses === 'number' &&
    typeof survey.response_count === 'number' &&
    survey.response_count >= survey.max_responses
  ) {
    return 'full'
  }

  if (survey.expires_at && new Date(survey.expires_at) < new Date()) {
    return 'expired'
  }

  if ((survey.status ?? 'open') === 'closed') {
    return 'closed'
  }

  return null
}

export function isSurveyClosed(survey: SurveyLifecycle) {
  return getSurveyClosureReason(survey) !== null
}

export type PublicCompletionReason = 'closed' | 'max_responses' | 'expired'

export function mapClosureReasonForPayload(
  reason: ReturnType<typeof getSurveyClosureReason>,
): PublicCompletionReason | null {
  if (reason === 'full') return 'max_responses'
  return reason
}

// Lazy expiry handling. If the survey has passed its expires_at and is still marked open,
// atomically transition it to closed and fire the completion webhook (idempotently).
// Returns the survey's effective status after handling — assign it back to keep local state in sync.
//
// Only fires 'expired' if THIS call performed the close. If the UPDATE returned zero rows,
// another path (e.g., concurrent PATCH manual close) already flipped the status — let that
// path's webhook fire the correct closed_reason. Without this guard, a stale expiry handler
// could win the completion_webhook_fired_at gate before the manual-close path stamps it,
// emitting 'expired' for a survey that was actually closed manually.
export async function ensureExpiredHandled(survey: {
  id: string
  status: string
  expires_at: string | null
}): Promise<string> {
  if (survey.status === 'closed') return survey.status
  if (!survey.expires_at) return survey.status
  if (new Date(survey.expires_at) > new Date()) return survey.status

  const closedRows = (await sql`
    UPDATE surveys SET status = 'closed'
    WHERE id = ${survey.id} AND status = 'open'
    RETURNING id
  `) as Array<{ id: string }>

  if (closedRows.length > 0) {
    await tryFireCompletionWebhook(survey.id, 'expired')
  }
  return 'closed'
}
