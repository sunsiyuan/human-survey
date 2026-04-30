# Async results loop — Phase 2 detailed plan

`expired` webhook trigger + atomic fire-once + `event_id` for idempotency. Brings the existing `webhook_url` from "fires on manual + max" to "fires on all three terminal events, exactly once."

Parent: [`async-results-loop.md`](./async-results-loop.md). Builds on Phase 1.

---

## What changes

| Surface | Before | After |
|---|---|---|
| Webhook payload | `{survey_id, status, closed_reason, response_count, closed_at}` | Same + `event_id` (nanoid). `closed_reason` enum gains `expired`. |
| Triggers | `manual` (PATCH), `max_responses` (POST response insert) | + `expired` (lazy detect on any read/write). |
| Idempotency | Implicit via `status === 'closed'` check (race-prone) | Atomic `UPDATE … WHERE completion_webhook_fired_at IS NULL RETURNING …` (race-proof). |

---

## Migration `006_async_results_loop.sql`

Adds three columns. Two go live in Phase 2; `notify_at_responses` is added now to keep migrations consolidated and used in Phase 3.

```sql
ALTER TABLE surveys ADD COLUMN completion_webhook_fired_at TIMESTAMPTZ;
ALTER TABLE surveys ADD COLUMN threshold_webhook_fired_at TIMESTAMPTZ;
ALTER TABLE surveys ADD COLUMN notify_at_responses INTEGER;

-- Treat already-closed surveys as already-notified. The previous code path fired
-- on transition to 'closed', so any closed survey that had a webhook_url has
-- already received its delivery. We never want a retroactive blast.
UPDATE surveys
SET completion_webhook_fired_at = COALESCE(created_at, now())
WHERE status = 'closed';
```

No new index — Phase 1's cursor work is JS-side; existing `idx_responses_survey` is enough.

---

## Files to touch

| File | Change |
|---|---|
| `apps/web/supabase/migrations/006_async_results_loop.sql` | NEW — schema above. |
| `apps/web/lib/webhook.ts` | Add `event_id` to payload type; add `expired` to `closed_reason` enum; add `tryFireCompletionWebhook(surveyId, reason)` atomic helper. |
| `apps/web/lib/lifecycle.ts` | Add `ensureExpiredHandled({id, status, expires_at})` — atomic status flip + webhook fire. |
| `apps/web/app/api/surveys/[id]/responses/route.ts` | POST: call `ensureExpiredHandled` before lifecycle check; on max-responses crossing, replace inline `fireWebhook` with `tryFireCompletionWebhook(id, 'max_responses')`. GET: call `ensureExpiredHandled` after fetching survey row. |
| `apps/web/app/api/surveys/[id]/route.ts` | GET (public): call `ensureExpiredHandled`. PATCH: replace inline webhook fire with `tryFireCompletionWebhook(id, 'manual')`. |
| `packages/mcp-server/src/index.ts` | Update `create_survey` description: webhook now fires on `expired` too; `event_id` field. No new args. |

---

## Detailed diffs

### 1. `lib/webhook.ts`

```ts
import { nanoid } from 'nanoid'

import { sql } from '@/lib/db'

export type CompletionWebhookPayload = {
  event_id: string
  survey_id: string
  status: 'closed'
  closed_reason: 'manual' | 'max_responses' | 'expired'
  response_count: number
  closed_at: string
}

export function fireWebhook(url: string, payload: CompletionWebhookPayload): void {
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error('Webhook delivery failed', url, err)
  })
}

/**
 * Atomically claim the completion-webhook fire slot for a survey and deliver if a
 * webhook_url is set. Safe to call concurrently from multiple paths (manual close,
 * max-responses, expired detection) — at most one delivery per survey.
 *
 * Side effects: writes completion_webhook_fired_at, fires HTTP request fire-and-forget.
 */
export async function tryFireCompletionWebhook(
  surveyId: string,
  reason: CompletionWebhookPayload['closed_reason'],
): Promise<void> {
  const rows = (await sql`
    UPDATE surveys
    SET completion_webhook_fired_at = now()
    WHERE id = ${surveyId} AND completion_webhook_fired_at IS NULL
    RETURNING webhook_url, response_count
  `) as Array<{ webhook_url: string | null; response_count: number }>

  const row = rows[0]
  if (!row?.webhook_url) return  // already fired, no webhook configured, or survey gone

  fireWebhook(row.webhook_url, {
    event_id: `evt_${nanoid(12)}`,
    survey_id: surveyId,
    status: 'closed',
    closed_reason: reason,
    response_count: row.response_count,
    closed_at: new Date().toISOString(),
  })
}
```

Backward compatibility: the new `event_id` field is additive. Existing webhook consumers that ignore unknown fields keep working.

### 2. `lib/lifecycle.ts`

```ts
import { sql } from '@/lib/db'
import { tryFireCompletionWebhook } from '@/lib/webhook'

/**
 * Lazy expiry handling. If the survey has passed its expires_at and is still
 * marked open, atomically transition it to closed and fire the completion webhook.
 *
 * Returns true if this call performed the transition, false otherwise.
 * Idempotent across concurrent calls — only one delivery total per survey.
 */
export async function ensureExpiredHandled(survey: {
  id: string
  status: string
  expires_at: string | null
}): Promise<boolean> {
  if (survey.status === 'closed') return false
  if (!survey.expires_at) return false
  if (new Date(survey.expires_at) > new Date()) return false

  // Atomic status flip — no-op if another path already did it.
  await sql`UPDATE surveys SET status = 'closed' WHERE id = ${survey.id} AND status = 'open'`
  // Atomic webhook claim — no-op if another path already fired.
  await tryFireCompletionWebhook(survey.id, 'expired')
  return true
}
```

### 3. POST `/api/surveys/[id]/responses`

The existing flow already returns 410 on expired; we add the side-effect call **before** the closure check so the webhook fires on the first interaction post-expiry:

```ts
const survey = surveyRows[0]
if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })

await ensureExpiredHandled(survey)
// re-read survey state if needed, OR just re-evaluate closure with updated knowledge
// (cheaper: re-call getSurveyClosureReason — note that ensureExpiredHandled has now
// flipped status to 'closed' if applicable, but our local `survey` object still says 'open'.
// Re-fetch to be safe, OR mutate locally:
if (await ensureExpiredHandled(survey)) {
  survey.status = 'closed'
}
```

Then the existing `getSurveyClosureReason(survey)` returns `'expired'` because `expires_at < now()` regardless of status, so the 410 response is unchanged.

Replace the max-responses fire site:

```ts
const newCount = survey.response_count + 1
if (survey.max_responses != null && newCount >= survey.max_responses) {
  await sql`UPDATE surveys SET status = 'closed' WHERE id = ${surveyId} AND status = 'open'`
  await tryFireCompletionWebhook(surveyId, 'max_responses')
}
```

(No more inline `fireWebhook(survey.webhook_url, {...})` — `tryFireCompletionWebhook` reads webhook_url from DB inside the atomic claim.)

### 4. GET `/api/surveys/[id]/responses`

Add a single line after the survey row fetch (before the cursor/aggregation work):

```ts
await ensureExpiredHandled(surveyRow)
```

If it returns true, `surveyRow.status` is locally still 'open' but the DB is now 'closed'. To make `is_final` reflect this without a re-fetch, set `surveyRow.status = 'closed'` after a positive return:

```ts
if (await ensureExpiredHandled(surveyRow)) {
  surveyRow.status = 'closed'
}
```

The recent-rate query and aggregation continue as before; `getSurveyClosureReason` will now correctly classify as `expired`.

### 5. GET `/api/surveys/[id]` (public meta)

```ts
const row = rows[0]
if (!row) return notFound()

if (await ensureExpiredHandled(row)) {
  row.status = 'closed'
}

return NextResponse.json({...row, schema: parseJsonValue(row.schema)})
```

**Note:** this is a public GET endpoint that now performs a write. Document this. The write is idempotent and bounded (at most one UPDATE per call, no-op for already-closed surveys), so the surface risk is small. The benefit is firing the expired-webhook close to actual expiry without needing a cron.

### 6. PATCH `/api/surveys/[id]` (manual close)

Replace:

```ts
if (nextStatus === 'closed' && existingSurvey.status !== 'closed' && updated.webhook_url) {
  fireWebhook(updated.webhook_url, {...})
}
```

with:

```ts
if (nextStatus === 'closed' && existingSurvey.status !== 'closed') {
  await tryFireCompletionWebhook(id, 'manual')
}
```

The race that existed (two concurrent PATCHes both seeing `existingSurvey.status !== 'closed'`) is now closed by the atomic claim.

### 7. MCP `create_survey` description

```ts
webhook_url: z.string().url().optional().describe(
  'Optional. URL to POST once when the survey closes. ' +
  'Payload: { event_id, survey_id, status: "closed", closed_reason: "manual" | "max_responses" | "expired", response_count, closed_at }. ' +
  'Use event_id to dedupe in case of retries. ' +
  'Fires on: manual close (close_survey), max_responses reached, or expires_at passed (lazy — within seconds of any next interaction with the survey).'
)
```

No new MCP arg in Phase 2.

---

## Concurrency / race analysis

Three concurrent paths can detect closure:

1. Response insert hits max_responses
2. PATCH flips to closed
3. Lazy expiry detection (any read/write)

For each, the sequence is now:
- (optional) UPDATE status to 'closed' WHERE status='open' — no-op if another beat us
- `tryFireCompletionWebhook` runs an atomic UPDATE on `completion_webhook_fired_at`

The webhook UPDATE is the serialization point. Postgres guarantees only one transaction sees `completion_webhook_fired_at IS NULL`. That one fires; the rest no-op.

`closed_reason` corresponds to whichever path won the race. If three paths arrive simultaneously, the agent gets one webhook with the reason of whichever path got the row first. Acceptable — all three are "closed", reason is best-effort.

---

## Acceptance test

Run on Vercel preview after migration is applied:

1. **Manual close fires once with event_id**
   - Create survey with `webhook_url`. POST nothing. PATCH to status='closed'.
   - Webhook arrives with `event_id: "evt_..."`, `closed_reason: "manual"`. PATCH again to status='closed' — no second fire.

2. **max_responses fires once**
   - Create with `webhook_url`, `max_responses: 2`. Submit 2 responses.
   - Webhook arrives with `closed_reason: "max_responses"`. Survey is `status: 'closed'`.

3. **expired fires lazily**
   - Create with `webhook_url`, `expires_at: now()+10s`. Wait 12s. GET `/api/surveys/{id}/responses`.
   - Webhook fires with `closed_reason: "expired"`. Survey is now `status: 'closed'` server-side.

4. **expired fires from public meta GET**
   - Same setup. After waiting, GET `/api/surveys/{id}` (no auth). Webhook fires.

5. **expired fires from response submission attempt**
   - Same setup. After waiting, POST `/api/surveys/{id}/responses` (returns 410). Webhook fires.

6. **No double-fire across paths**
   - Create with `webhook_url`, `max_responses: 1`, `expires_at: now()+5s`. Submit 1 response (max_responses fires). Wait 10s, GET responses. No second webhook (would be `expired` if we hadn't already fired `max_responses`).

7. **Backfill correctness**
   - Pre-migration closed surveys remain at `status='closed'`. Apply migration. Confirm `completion_webhook_fired_at IS NOT NULL` for them. Manually PATCH one back to open (admin only) — re-close — should fire webhook again? No: `completion_webhook_fired_at` blocks. Document: re-opening a closed survey is rare and re-firing the webhook is intentionally not supported (use a fresh survey).

8. **Concurrent fire-once**
   - Manually trigger two simultaneous PATCH-to-closed via parallel curl. Verify only one webhook delivery (use webhook.site for inspection).

---

## Risks

- **Public GET performs a write.** Acceptable trade-off; one bounded UPDATE per call. If observed to be hot path (millions of public reads), gate behind a TTL cache or move to cron.
- **`event_id` field added.** Some webhook consumers may have schemas that reject unknown fields. Mitigation: documented as additive in MCP description and `/docs`. Consumers should ignore unknown fields by convention.
- **Re-opening a closed survey loses its fire-once flag forever.** Documented; expected. Alternative: clear `completion_webhook_fired_at` when re-opening, allowing a second fire. Defer until an actual user wants this.
- **Lazy expiry latency.** A truly idle expired survey (no reads, no writes) won't fire its webhook until someone interacts with it. Document as "fires within seconds of next interaction; for guaranteed cadence, use max_responses or close manually." If a customer needs <5min guarantee, add a cron sweeper.

---

## Done when

- Migration 006 applied locally and on Vercel preview.
- `pnpm --filter web build` and `pnpm --filter humansurvey-mcp build` pass.
- Manual test cases 1–8 pass.
- Two reviews completed (concurrency/race + migration safety).
- Single commit on `feat/async-results-loop` with message `feat(api): expired webhook + event_id + atomic fire-once`.
