# Async results loop — Phase 3 detailed plan

Threshold notification — `notify_at_responses` field on create, fires the existing webhook URL with a `threshold_reached` event when the response count first crosses the threshold. Survey stays open. Agent acts on partial signal without waiting for closure.

Parent: [`async-results-loop.md`](./async-results-loop.md). Builds on Phase 2.

---

## Design recap

Phase 2 added two columns we use here:
- `threshold_webhook_fired_at TIMESTAMPTZ` — the fire-once flag (separate from `completion_webhook_fired_at` so threshold and closure events fire independently)
- `notify_at_responses INTEGER` — the threshold the agent specified at create

Threshold uses the **same** `webhook_url` as the completion event. Differentiation is via the `event` field in the payload + the separate fire-once flag. Two flags = the two events can both fire over the lifetime of a single survey.

**Event semantics:** if `notify_at_responses < max_responses`, threshold fires first (status open) and completion fires later (status closed). If `notify_at_responses === max_responses`, both fire on the same response insert (separate atomic claims, separate event_ids). If `notify_at_responses > max_responses`, threshold never fires because completion closes the survey first — reject this combination at create time so users don't silently lose a wake-up they expected.

---

## Files to touch

| File | Change |
|---|---|
| `apps/web/lib/webhook.ts` | Add `ThresholdWebhookPayload` type. Update `fireWebhook` to accept the union. Add `tryFireThresholdWebhook(surveyId)` atomic helper. |
| `apps/web/app/api/surveys/route.ts` (POST) | Accept + validate `notify_at_responses`. INSERT it on create. |
| `apps/web/app/api/surveys/[id]/responses/route.ts` (POST) | SELECT `notify_at_responses` upfront. After successful insert, if `newCount >= notify_at_responses`, call `tryFireThresholdWebhook`. |
| `packages/mcp-server/src/index.ts` | `create_survey` accepts `notify_at_responses`. Description explains threshold semantics. Forward to API. |

No migration — Phase 2's 006 already added the columns.

---

## Detailed diffs

### 1. `lib/webhook.ts`

```ts
export type CompletionWebhookPayload = {
  event_id: string
  survey_id: string
  status: 'closed'
  closed_reason: 'manual' | 'max_responses' | 'expired'
  response_count: number
  closed_at: string
}

export type ThresholdWebhookPayload = {
  event_id: string
  event: 'threshold_reached'
  survey_id: string
  status: 'open'
  response_count: number
  threshold: number
  fired_at: string
}

export type WebhookPayload = CompletionWebhookPayload | ThresholdWebhookPayload

export function fireWebhook(url: string, payload: WebhookPayload): void {
  // unchanged body
}

// Atomically claim the threshold-webhook fire slot. Same race-proof pattern as the
// completion variant, with its own column. Survey stays open after firing — this
// is a "you have enough signal" event, not a terminal one.
export async function tryFireThresholdWebhook(surveyId: string): Promise<void> {
  const rows = (await sql`
    UPDATE surveys
    SET threshold_webhook_fired_at = now()
    WHERE id = ${surveyId}
      AND threshold_webhook_fired_at IS NULL
      AND notify_at_responses IS NOT NULL
    RETURNING webhook_url, response_count, notify_at_responses
  `) as Array<{
    webhook_url: string | null
    response_count: number
    notify_at_responses: number | null
  }>

  const row = rows[0]
  if (!row?.webhook_url || row.notify_at_responses == null) return

  fireWebhook(row.webhook_url, {
    event_id: `evt_${nanoid(12)}`,
    event: 'threshold_reached',
    survey_id: surveyId,
    status: 'open',
    response_count: row.response_count,
    threshold: row.notify_at_responses,
    fired_at: new Date().toISOString(),
  })
}
```

The `event_id` discriminates threshold vs completion when an agent host receives both for the same survey. The `event: 'threshold_reached'` field exists explicitly because the completion payload has no `event` field — letting consumers branch on `'event' in payload`.

### 2. POST `/api/surveys` — accept `notify_at_responses`

Add to body parsing:

```ts
const notifyAtResponses = body?.notify_at_responses
```

Add validation:

```ts
if (
  notifyAtResponses !== undefined &&
  notifyAtResponses !== null &&
  (!Number.isInteger(notifyAtResponses) || notifyAtResponses <= 0)
) {
  return NextResponse.json(
    { error: 'notify_at_responses must be a positive integer' },
    { status: 400 },
  )
}

if (
  notifyAtResponses != null &&
  maxResponses != null &&
  notifyAtResponses > maxResponses
) {
  return NextResponse.json(
    {
      error:
        'notify_at_responses must be ≤ max_responses; otherwise the threshold would never fire (max_responses closes the survey first)',
    },
    { status: 400 },
  )
}
```

Add to INSERT column list and VALUES:

```ts
INSERT INTO surveys (
  ..., notify_at_responses, ...
) VALUES (
  ..., ${notifyAtResponses ?? null}, ...
)
```

### 3. POST `/api/surveys/[id]/responses` — fire threshold on crossing

Augment the SELECT to fetch `notify_at_responses`:

```ts
SELECT id, status, response_count, max_responses, expires_at, notify_at_responses
FROM surveys
WHERE id = ${surveyId}
LIMIT 1
```

Update the destructured row type accordingly.

After the INSERT and the existing max_responses block, add:

```ts
if (survey.notify_at_responses != null && newCount >= survey.notify_at_responses) {
  await tryFireThresholdWebhook(surveyId)
}
```

`tryFireThresholdWebhook` is idempotent — concurrent crossings race-claim, only one fires. If `newCount` already exceeds (e.g. response 7 of threshold 5 because the first 5 racy-fired), the helper's `WHERE threshold_webhook_fired_at IS NULL` no-ops.

If both `max_responses` and `notify_at_responses` cross on the same response (equal values), both fires happen — separate fire-once columns, separate `event_id`s. Two webhooks delivered, one with `event: 'threshold_reached', status: 'open'`, the other with `event: 'survey_closed', status: 'closed', closed_reason: 'max_responses'`.

**Order within a single request: threshold first, completion second.** This keeps the threshold event's `status: 'open'` accurate (at the moment it fires the survey hasn't been closed yet). The threshold UPDATE additionally guards on `status = 'open'` so it never fires against an already-closed survey. Network delivery order is not guaranteed; consumers branch on the `event` field, not arrival order.

### 4. MCP `create_survey` arg

```ts
notify_at_responses: z.number().int().positive().optional().describe(
  'Optional. Fire the webhook once when this many responses arrive. ' +
  'The survey stays open — use this to wake the agent on "enough signal" without waiting for full closure. ' +
  'Payload includes event: "threshold_reached" and status: "open" to distinguish from the closure event. ' +
  'Must be ≤ max_responses if both are set; otherwise the threshold would never fire.'
),
```

Add to body sent to API:

```ts
body: JSON.stringify({ schema, max_responses, expires_at, webhook_url, notify_at_responses }),
```

---

## Acceptance test

Run on Vercel preview (Phase 2 migration must already be applied):

1. **Threshold fires once at exact crossing**
   - Create with `webhook_url`, `notify_at_responses: 3`. Submit 3 responses.
   - Webhook fires with `event: 'threshold_reached'`, `status: 'open'`, `response_count: 3`, `threshold: 3`. Survey is `status: 'open'`. Submit 4th response — no second threshold webhook (fire-once).

2. **Threshold below max — both fire**
   - Create with `webhook_url`, `notify_at_responses: 3`, `max_responses: 5`. Submit 3 responses → threshold fires (status open). Submit 2 more (total 5) → completion fires with `closed_reason: 'max_responses'`. Both `event_id`s are distinct.

3. **Threshold equal to max — both fire on same response**
   - Create with `webhook_url`, `notify_at_responses: 3`, `max_responses: 3`. Submit 3 responses. Two webhooks delivered: one threshold (`status: 'open'`), one completion (`status: 'closed'`).

4. **Threshold > max — rejected at create**
   - POST with `notify_at_responses: 5`, `max_responses: 3` → 400 with explanatory error.

5. **Negative or non-integer threshold rejected**
   - `notify_at_responses: 0` → 400. `notify_at_responses: 2.5` → 400. `notify_at_responses: "five"` → 400.

6. **Concurrent crossing fires once**
   - Create with `notify_at_responses: 3`. Send 5 simultaneous response submissions. At most one threshold webhook delivered (verify via webhook.site).

7. **No webhook_url → no fire, but flag still set**
   - Create with `notify_at_responses: 3`, no `webhook_url`. Submit 3 responses. No webhook (none configured). Survey row has `threshold_webhook_fired_at IS NOT NULL` (consistent with completion semantics: column means "fire opportunity consumed").

8. **MCP exposure**
   - From Claude Code, `create_survey({schema, notify_at_responses: 5, webhook_url: "..."})` succeeds. Tool description for the arg explains threshold semantics.

---

## Risks

- **Twin-fire on threshold == max**. Two webhook deliveries on the same response insert, close in time. Documented and tested. Agents must dedupe by `event_id` if they care about exactly-once act semantics.
- **Threshold delivery still fire-and-forget.** Same retry-less limitation as completion. Phase 2 documented. No regression.
- **Order of completion vs threshold within a request is not guaranteed network-side.** Document. The two events have distinct payload shapes, so consumers can branch on `'event' in payload`.
- **Backward compat.** Adding the `notify_at_responses` field to POST is additive. Existing surveys created without it get NULL, threshold path no-ops. Webhook receivers that ignored unknown fields keep working; new `event` field is additive on the threshold variant only.

---

## Done when

- `pnpm --filter web build` and `pnpm --filter humansurvey-mcp build` pass.
- Manual test cases 1–8 pass on Vercel preview.
- Two reviews completed (event-shape consistency + at-create validation).
- Single commit on `feat/async-results-loop` with message `feat(api): notify_at_responses + threshold_reached webhook event`.
