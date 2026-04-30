import { NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth'
import { sql, parseJsonValue } from '@/lib/db'
import { ensureExpiredHandled } from '@/lib/lifecycle'
import { tryFireCompletionWebhook } from '@/lib/webhook'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const rows = (await sql`
      SELECT id, title, description, schema, response_count, status, max_responses, expires_at
      FROM surveys
      WHERE id = ${id}
      LIMIT 1
    `) as Array<{
      id: string
      title: string
      description: string | null
      schema: unknown
      response_count: number
      status: string
      max_responses: number | null
      expires_at: string | null
    }>

    const row = rows[0]

    if (!row) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    row.status = await ensureExpiredHandled({
      id: row.id,
      status: row.status,
      expires_at: row.expires_at,
    })

    return NextResponse.json({
      ...row,
      schema: parseJsonValue(row.schema),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id } = await context.params
  const body = (await request.json().catch(() => null)) as
    | { status?: string; max_responses?: number | null; expires_at?: string | null }
    | null

  if (!body) {
    return NextResponse.json({ error: 'Request body is required' }, { status: 400 })
  }

  if (
    body.status !== undefined &&
    body.status !== 'open' &&
    body.status !== 'closed'
  ) {
    return NextResponse.json({ error: "status must be 'open' or 'closed'" }, { status: 400 })
  }

  if (
    body.max_responses !== undefined &&
    body.max_responses !== null &&
    (!Number.isInteger(body.max_responses) || body.max_responses <= 0)
  ) {
    return NextResponse.json(
      { error: 'max_responses must be a positive integer' },
      { status: 400 },
    )
  }

  if (
    body.expires_at !== undefined &&
    body.expires_at !== null &&
    Number.isNaN(Date.parse(body.expires_at))
  ) {
    return NextResponse.json(
      { error: 'expires_at must be a valid ISO date' },
      { status: 400 },
    )
  }

  try {
    const rows = (await sql`
      SELECT id, api_key_id, status, max_responses, expires_at
      FROM surveys
      WHERE id = ${id}
      LIMIT 1
    `) as Array<{
      id: string
      api_key_id: string | null
      status: string
      max_responses: number | null
      expires_at: string | null
    }>

    const existingSurvey = rows[0]

    if (!existingSurvey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    if (existingSurvey.api_key_id !== auth.keyId) {
      return NextResponse.json(
        { error: 'You do not have access to this survey' },
        { status: 403 },
      )
    }

    const nextStatus = body.status ?? existingSurvey.status
    const nextMaxResponses =
      body.max_responses !== undefined ? body.max_responses : existingSurvey.max_responses
    const isManualClose = nextStatus === 'closed' && existingSurvey.status !== 'closed'
    const isReopen = nextStatus === 'open' && existingSurvey.status === 'closed'
    // Clear expires_at on manual close so cursor reads stably report
    // completion_reason='closed' rather than drifting to 'expired' once wall-clock passes
    // a future deadline. The webhook already fired with 'manual'; the persisted state
    // must match.
    const nextExpiresAt = isManualClose
      ? null
      : body.expires_at !== undefined
        ? body.expires_at
        : existingSurvey.expires_at

    // Reopen starts a new collection cycle: clear the completion-webhook fire-once gate
    // so the next close (manual / max / expired) delivers a fresh `survey_closed` event.
    // threshold_webhook_fired_at is intentionally NOT cleared — "enough signal" is a
    // count-based fact that doesn't reset just because the owner reopened.
    const updatedRows = (await sql`
      UPDATE surveys
      SET
        status = ${nextStatus},
        max_responses = ${nextMaxResponses},
        expires_at = ${nextExpiresAt}::timestamptz,
        completion_webhook_fired_at = CASE
          WHEN ${isReopen} THEN NULL
          ELSE completion_webhook_fired_at
        END
      WHERE id = ${id} AND api_key_id = ${auth.keyId}
      RETURNING id, status, max_responses, expires_at, response_count
    `) as Array<{
      id: string
      status: string
      max_responses: number | null
      expires_at: string | null
      response_count: number
    }>

    const updated = updatedRows[0]

    if (isManualClose) {
      await tryFireCompletionWebhook(id, 'manual')
    }

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      max_responses: updated.max_responses,
      expires_at: updated.expires_at,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
