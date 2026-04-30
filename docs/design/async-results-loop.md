# Async results loop — design + implementation plan

How HumanSurvey supports the agent loop for surveys whose collection window is hours/days, not seconds. The agent shouldn't busy-poll, and the agent's session won't stay alive that long. The right primitive is **wake + resume**, not **wait**.

This doc is both the design rationale and the implementation plan, since the design is small and the implementation is the load-bearing part.

---

## Why this is the next scope after L1 embed

Three constraints that hour/day timescales impose:

1. **Agent sessions don't span hours.** A Claude Code task or a Claude API turn lives minutes-to-tens-of-minutes. If a survey returns over a day, the agent has long gone idle by the time results matter.
2. **Polling is a tax.** Asking the agent host to keep an agent alive and `get_results` in a loop burns context, tokens, and quota. Most agent harnesses don't even support that shape.
3. **The act may not need full closure.** Many agent decisions need "enough signal," not "100% complete." Forcing the agent to wait until expiry doubles tail latency.

→ The correct loop is: agent creates the survey, **exits**, and gets pulled back later by an external signal (webhook into the agent host) or a scheduled re-invocation. We provide both a push path (webhook) and a pull path (cursor read with `is_final`) — pull is the authoritative fallback because webhooks get lost.

---

## What we already have

- `surveys.webhook_url` (column exists since `003_add_webhook_url.sql`)
- Webhook fires on `manual` close (`PATCH /api/surveys/{id}`) and `max_responses` (`POST /api/surveys/{id}/responses`)
- Payload: `{survey_id, status: 'closed', closed_reason, response_count, closed_at}`
- MCP `create_survey` exposes `webhook_url` arg

## What's missing

| Gap | Effect |
|---|---|
| `expired` does not fire the webhook | Surveys that close by `expires_at` never wake the agent. Agent has to poll. |
| No threshold trigger (`notify_at_responses`) | Agent that wants "wake me at 50 of max 100" can't express it. |
| No `event_id` on payload | Agent host can't dedupe webhook retries. |
| `GET /api/surveys/{id}/responses` returns full aggregate every time | On day-2 re-entry, agent re-reads day-1 data. Burns context. |
| No `is_final` / `completion_reason` in result payload | Agent can't tell "still collecting" from "done, act now." Currently a heuristic in MCP text formatter. |
| No `next_check_hint_seconds` | Agent host without webhook capability has no signal for backoff cadence. |

---

## Design

Three primitives. They compose: agent uses webhook for the happy path, falls back to cursor poll if it missed the webhook, uses `is_final` to know when to stop checking.

### Primitive 1 — Completion webhook, fully populated

Extend the existing `webhook_url` to fire on **all** terminal events:

| Trigger | `closed_reason` | Survey status after |
|---|---|---|
| Owner calls `PATCH status=closed` | `manual` | `closed` |
| Response insert that hits `max_responses` | `max_responses` | `closed` |
| **NEW**: any read/write detects `expires_at` has passed | `expired` | `closed` (lazy-flipped) |

Fire-once enforced atomically via a new `completion_webhook_fired_at` column. Same column closes the race between the three paths — only one wins.

Payload gains `event_id`:

```json
{
  "event_id": "evt_<nanoid12>",
  "survey_id": "abc",
  "status": "closed",
  "closed_reason": "manual" | "max_responses" | "expired",
  "response_count": 47,
  "closed_at": "2026-04-30T12:34:56Z"
}
```

### Primitive 2 — Threshold notification

A separate event for "I have enough signal":

- New survey field: `notify_at_responses INTEGER` (optional, set on create)
- New webhook fire when `response_count >= notify_at_responses` for the first time
- Fire-once enforced via `threshold_webhook_fired_at` column
- Survey **stays open**; this is signal, not termination

Payload (note `status: 'open'` and a new `event` field that distinguishes from completion):

```json
{
  "event_id": "evt_xxx",
  "event": "threshold_reached",
  "survey_id": "abc",
  "status": "open",
  "response_count": 50,
  "threshold": 50,
  "fired_at": "2026-04-30T11:00:00Z"
}
```

The agent typically acts on threshold and ignores the later completion webhook. Agents that want both events get both (separate fire-once flags).

### Primitive 3 — Cursor-aware results read

`GET /api/surveys/{id}/responses` gains optional `since_response_id`. The aggregate fields (`questions[].tally`, `stats`, etc.) always reflect the **full** survey — they're cheap and correct that way. The cursor only affects which raw responses are returned.

New response shape:

```json
{
  "count": 47,
  "is_final": false,
  "completion_reason": null,
  "next_check_hint_seconds": 600,
  "next_cursor": "resp_xyz",
  "questions": [...],
  "raw": [...only responses since cursor, newest first...]
}
```

`next_check_hint_seconds` heuristic (server-computed):

- `null` if `is_final` is true (don't check again)
- Base: 300s if recent-rate ≥ 1 response / 10 min, else 1800s
- Capped: never more than `floor((expires_at - now) / 4)`, never less than 60s

Cursor encoding: `since_response_id` (existing nanoid). Server looks up `(created_at, id)` of that row, returns rows where `(created_at, id) > (cursor.created_at, cursor.id)`. No new column needed; existing `idx_responses_survey` index plus a follow-up `(survey_id, created_at, id)` composite index covers it.

---

## Files this touches

| Path | Role |
|---|---|
| `apps/web/supabase/migrations/006_async_results_loop.sql` | New migration — 3 columns + 1 index, backfill logic |
| `apps/web/lib/lifecycle.ts` | `getSurveyClosureReason` already returns `expired`; add helper to mark survey closed when expired is observed |
| `apps/web/lib/webhook.ts` | New `WebhookPayload` variants (add `expired`, add threshold event); add `event_id` |
| `apps/web/lib/results.ts` | `aggregateSurveyResults` extended to compute `is_final`, `completion_reason`, `next_check_hint_seconds` |
| `apps/web/lib/db.ts` | Helper for atomic "fire-once" UPDATE pattern |
| `apps/web/app/api/surveys/route.ts` | POST: accept `notify_at_responses` arg |
| `apps/web/app/api/surveys/[id]/route.ts` | GET (public meta) and PATCH; lazy-detect expired and fire webhook |
| `apps/web/app/api/surveys/[id]/responses/route.ts` | GET: cursor + new fields. POST: lazy-detect expired before insert; fire threshold webhook on count crossing |
| `packages/mcp-server/src/index.ts` | `create_survey` arg `notify_at_responses`; `get_results` arg `since_response_id`; format using `is_final` / `next_check_hint_seconds` |
| `apps/web/app/docs/page.tsx` | "Async results" section explaining webhook events + cursor reads |
| `apps/web/public/llms.txt` & `llms-full.txt` | Mirror docs for AI consumption |

---

## Phase 1 — cursor + `is_final` + hint (~0.5 day)

**Goal:** any agent re-entering a survey gets only-new responses, knows when to stop checking, and has a server-suggested cadence. **No schema migration. No webhook changes.** Highest-value-per-effort piece; ship first.

### 1.1 `aggregateSurveyResults` returns the new fields

In `apps/web/lib/results.ts`, extend the return shape:

```ts
type ResultsPayload = {
  // existing
  count: number
  questions: ResultsQuestion[]
  raw: ResponseRecord[]
  // new
  is_final: boolean
  completion_reason: 'closed' | 'expired' | 'max_responses' | null
  next_check_hint_seconds: number | null
  next_cursor: string | null
}
```

`is_final` = `getSurveyClosureReason(survey) !== null`.
`completion_reason` = the same string ('closed' / 'expired' / 'full' → rename `full` to `max_responses` in the public payload for consistency with webhook).
`next_check_hint_seconds` = computed from recent-rate query + `expires_at`.
`next_cursor` = `raw[0]?.id` (raw is sorted DESC by created_at, so latest is first; cursor advances forward).

### 1.2 GET `/api/surveys/[id]/responses` accepts `since_response_id`

In the GET handler:

```ts
const since = new URL(request.url).searchParams.get('since_response_id')

let cursorClause = sql``
if (since) {
  const cursorRow = (await sql`SELECT created_at, id FROM responses WHERE id = ${since} LIMIT 1`)[0]
  if (cursorRow) {
    cursorClause = sql`AND (created_at, id) > (${cursorRow.created_at}, ${cursorRow.id})`
  }
}

const responseRows = await sql`
  SELECT id, answers, created_at FROM responses
  WHERE survey_id = ${surveyId} ${cursorClause}
  ORDER BY created_at DESC, id DESC
`
```

Aggregates always run over the **full** response set (separate query) — cursor only filters `raw`. Document this in the response contract.

If `since` is supplied but doesn't match any row, ignore it (return everything). Don't 400 — agent re-entry shouldn't fail because a response was deleted.

### 1.3 Recent-rate computation

```sql
SELECT COUNT(*) FROM responses
WHERE survey_id = $1 AND created_at > now() - interval '1 hour'
```

Cache-friendly (small index scan). One extra query per `get_results` call. Acceptable overhead.

### 1.4 MCP changes

`get_results` gains `since_response_id` arg, passes through to API. `formatResultsSummary` uses `is_final` / `completion_reason` / `next_check_hint_seconds` to write a more directive footer:

```
Status: open | 47 responses
Recommended next check: ~10 minutes (next_check_hint_seconds=600)
```

vs

```
Status: closed | reason: expired | 47 responses
Collection complete. Act on these results.
```

### 1.5 Acceptance check

- Create a survey, post 5 responses.
- `get_results(survey_id)` → returns 5 raw, `is_final=false`, hint > 0, `next_cursor` set.
- `get_results(survey_id, since_response_id=<cursor>)` → returns 0 raw (no new), aggregates unchanged.
- Post 2 more responses. `get_results(survey_id, since_response_id=<old cursor>)` → returns 2 raw.
- Close survey. `get_results` → `is_final=true`, hint `null`.

---

## Phase 2 — expired trigger + `event_id` (~0.5 day)

**Goal:** the existing webhook fires on **all three** terminal events (manual, max, expired), with idempotency. Survey closure becomes uniformly observable for an agent host that subscribed.

### 2.1 Migration `006_async_results_loop.sql`

```sql
ALTER TABLE surveys ADD COLUMN completion_webhook_fired_at TIMESTAMPTZ;
ALTER TABLE surveys ADD COLUMN threshold_webhook_fired_at TIMESTAMPTZ;
ALTER TABLE surveys ADD COLUMN notify_at_responses INTEGER;

-- Treat already-closed surveys as already-notified, since the existing
-- code paths fired on transition to 'closed' and we don't want a retroactive blast.
UPDATE surveys
SET completion_webhook_fired_at = COALESCE(created_at, now())
WHERE status = 'closed';

CREATE INDEX idx_responses_survey_created_id
  ON responses (survey_id, created_at DESC, id DESC);
```

### 2.2 Atomic fire-once helper

In `apps/web/lib/webhook.ts`:

```ts
export async function tryFireCompletionWebhook(
  surveyId: string,
  reason: 'manual' | 'max_responses' | 'expired',
): Promise<void> {
  const rows = await sql`
    UPDATE surveys
    SET completion_webhook_fired_at = now()
    WHERE id = ${surveyId} AND completion_webhook_fired_at IS NULL
    RETURNING webhook_url, response_count
  `
  const row = rows[0]
  if (!row?.webhook_url) return

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

Key property: the conditional UPDATE is atomic, so two concurrent paths (e.g. expired-detection + manual-close) can't both fire. First one wins.

### 2.3 Replace existing fire sites

- `POST /api/surveys/[id]/responses`: when `newCount >= max_responses`, replace inline `fireWebhook` call with `tryFireCompletionWebhook(surveyId, 'max_responses')`. Still flip status to `closed`.
- `PATCH /api/surveys/[id]`: when status transitions to `closed`, call `tryFireCompletionWebhook(surveyId, 'manual')`.

### 2.4 Lazy expired detection

Add helper in `apps/web/lib/lifecycle.ts`:

```ts
export async function ensureExpiredHandled(survey: { id, status, expires_at }): Promise<boolean> {
  if (survey.status === 'closed') return false
  if (!survey.expires_at) return false
  if (new Date(survey.expires_at) > new Date()) return false

  await sql`UPDATE surveys SET status = 'closed' WHERE id = ${survey.id} AND status = 'open'`
  await tryFireCompletionWebhook(survey.id, 'expired')
  return true
}
```

Call from:
- `POST /api/surveys/[id]/responses` (existing flow already returns 410 expired — also call this so webhook fires)
- `GET /api/surveys/[id]/responses` (when owner reads results)
- `GET /api/surveys/[id]` (public meta read by survey page SSR)

This is **lazy** — no cron. Latency: webhook fires at "next interaction after expiry," typically within minutes for an active survey, possibly longer for a quiet one. Acceptable for v1; document the latency. Cron is an option later if a customer needs <5min guarantee.

### 2.5 Update `WebhookPayload` type

```ts
type CompletionWebhookPayload = {
  event_id: string
  survey_id: string
  status: 'closed'
  closed_reason: 'manual' | 'max_responses' | 'expired'
  response_count: number
  closed_at: string
}
```

Update MCP `create_survey` description to mention `expired` and `event_id`.

### 2.6 Acceptance check

- Create survey with `webhook_url` and `expires_at` 30s in the future.
- Wait 30s. Submit a response — should 410. Webhook fires once with `closed_reason: expired`, `event_id` populated.
- Submit second response — webhook does **not** fire again (fire-once). Survey is `closed`.
- Hit owner GET `/api/surveys/{id}` for an unrelated survey with elapsed `expires_at` and no prior interactions — webhook fires.

---

## Phase 3 — threshold notification (~0.5 day)

**Goal:** agent sets `notify_at_responses=N`, gets woken at the first crossing, can act on partial signal without waiting for closure.

### 3.1 Accept `notify_at_responses` on create

In `apps/web/app/api/surveys/route.ts` POST handler:
- Accept `notify_at_responses?: number` in body
- Validate: positive integer, ≤ `max_responses` if both set (warn or reject)
- Persist on insert

### 3.2 Fire on threshold crossing

In `POST /api/surveys/[id]/responses`, after successful insert:

```ts
if (
  survey.notify_at_responses != null &&
  newCount >= survey.notify_at_responses &&
  !survey.threshold_webhook_fired_at
) {
  // atomic fire-once
  const fired = await sql`
    UPDATE surveys
    SET threshold_webhook_fired_at = now()
    WHERE id = ${surveyId} AND threshold_webhook_fired_at IS NULL
    RETURNING webhook_url, response_count, notify_at_responses
  `
  if (fired[0]?.webhook_url) {
    fireWebhook(fired[0].webhook_url, {
      event_id: `evt_${nanoid(12)}`,
      event: 'threshold_reached',
      survey_id: surveyId,
      status: 'open',
      response_count: fired[0].response_count,
      threshold: fired[0].notify_at_responses,
      fired_at: new Date().toISOString(),
    })
  }
}
```

Survey stays open. Agent that wants to also be woken on closure gets a separate `closed` event later.

### 3.3 MCP `create_survey` exposes the arg

```ts
notify_at_responses: z.number().int().positive().optional().describe(
  'Optional. Fire the webhook once when this many responses arrive — survey stays open. ' +
  'Use this to wake the agent when there is enough signal to act, without waiting for full closure. ' +
  'Payload includes event: "threshold_reached", status: "open". Distinct from the completion event fired on close.'
)
```

### 3.4 Acceptance check

- Create survey with `webhook_url`, `max_responses=10`, `notify_at_responses=3`.
- Post 3 responses. Webhook fires with `event: 'threshold_reached'`, `status: 'open'`.
- Post 4th, 5th. No additional webhook (fire-once).
- Post until 10. Webhook fires with `event: undefined` (or `'completed'`), `closed_reason: 'max_responses'`. Two separate `event_id` values.

---

## Out of scope (do not do now)

- **Cron-based expiry sweep** — lazy-on-interaction is enough for v1. Add cron only when a host complains about latency.
- **Webhook retries / DLQ / signing secret** — same posture as L1, hold until observed need.
- **Long-poll / SSE subscription endpoint** — wrong shape for hours/days; would tie up serverless connections.
- **Per-question threshold (`notify_when_q3_majority_picks_X`)** — interesting but speculative; not until an agent asks for it.
- **Multiple webhooks per survey** — current model is single URL, both events go to it. Disambiguated via `event_id` and reason fields. Multi-URL = scope creep.
- **Aggregated summary in webhook payload** — keep payload thin (~200 bytes); agent does GET to fetch fresh state. Avoids stale-payload race.

---

## Ship order

| Day | Work |
|---|---|
| 1 AM | Phase 1: `aggregateSurveyResults` extension, GET `since_response_id`, recent-rate query, MCP `get_results` arg |
| 1 PM | Phase 1 acceptance test on Vercel preview; ship to production |
| 2 AM | Phase 2: migration 006, `tryFireCompletionWebhook` helper, replace existing fire sites, lazy expired detection |
| 2 PM | Phase 2 acceptance test; ship |
| 3 AM | Phase 3: `notify_at_responses`, threshold fire, MCP arg |
| 3 PM | Phase 3 acceptance + docs (`/docs#async-results`, `llms.txt`, `llms-full.txt`) + MCP version bump (`humansurvey-mcp@0.5.0`) + npm publish |

Three days end-to-end. Phase 1 is the cheapest and most universally useful — ship it first even if 2 + 3 slip.

---

## After this ships

The agent-loop primitives are then complete enough that we can write a "How agents use HumanSurvey" page (copy lives in `/docs` or as a blog post) showing the canonical loop:

```
agent: create_survey(notify_at_responses=N, webhook_url=<host wake URL>)
agent: exits

[hours later, threshold reached]
host: receives webhook
host: re-invokes agent with survey_id

agent: get_results(survey_id, since_response_id=<previous cursor>)
agent: acts on results
```

That single example is more positioning-defining than any feature: it's what "feedback infrastructure for AI agents" actually looks like in code.
