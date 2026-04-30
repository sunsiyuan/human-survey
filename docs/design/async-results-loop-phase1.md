# Async results loop — Phase 1 detailed plan

Cursor reads + `is_final` + `next_check_hint_seconds`. No schema migration. Highest value-per-effort piece; ships first.

Parent: [`async-results-loop.md`](./async-results-loop.md)

---

## Files to touch

| File | Change |
|---|---|
| `apps/web/lib/results.ts` | Extend `AggregatedSurveyResults` type with new fields. Aggregator stays focused on aggregation; new fields populated by route. |
| `apps/web/lib/lifecycle.ts` | Add `mapClosureReasonForPayload` helper that maps `'full'` → `'max_responses'` to align with webhook semantics. |
| `apps/web/lib/results.ts` (or new `lib/check-hint.ts`) | `computeNextCheckHintSeconds(rate1h, expiresAt, isFinal)` pure function. |
| `apps/web/app/api/surveys/[id]/responses/route.ts` | GET: parse `since_response_id`, fetch full responses + recent-rate count, fetch survey lifecycle fields, assemble new payload shape. |
| `packages/mcp-server/src/index.ts` | `get_results` accepts `since_response_id`. Format consumes `is_final` / `completion_reason` / `next_check_hint_seconds` / `next_cursor`. Bump version to `0.5.0` (publish in final phase). |

---

## Detailed diffs

### 1. `lib/results.ts` — type + payload assembly helper

Extend `AggregatedSurveyResults`:

```ts
export type AggregatedSurveyResults = {
  count: number                                       // unchanged: total response count
  questions: ResultsQuestion[]                        // unchanged: full-set aggregation
  raw: ResponseRecord[]                               // SEMANTICS CHANGE: cursor-filtered when since is supplied
  is_final: boolean                                   // NEW
  completion_reason: 'closed' | 'max_responses' | 'expired' | null  // NEW
  next_check_hint_seconds: number | null              // NEW
  next_cursor: string | null                          // NEW: id of newest response in full set
}
```

Backward-compat note: existing API consumers (the survey results page for owners — let me grep) currently treat `raw` as full set. Before changing semantics on `raw`, audit.

**Audit step before coding:** grep callers of the responses endpoint. If any caller depends on `raw = full set`, add an opt-in: cursor only filters `raw` when `since_response_id` is **provided**. Default behavior unchanged.

`aggregateSurveyResults` itself keeps its signature; the new fields get assembled in the route. Export a small helper:

```ts
export function buildResultsPayload(args: {
  survey: Survey
  allResponses: ResponseRecord[]
  filteredRaw: ResponseRecord[]
  isFinal: boolean
  completionReason: AggregatedSurveyResults['completion_reason']
  nextCheckHintSeconds: number | null
}): AggregatedSurveyResults {
  const aggregated = aggregateSurveyResults(args.survey, args.allResponses)
  return {
    ...aggregated,
    raw: args.filteredRaw,
    is_final: args.isFinal,
    completion_reason: args.completionReason,
    next_check_hint_seconds: args.nextCheckHintSeconds,
    next_cursor: args.allResponses[0]?.id ?? null,
  }
}
```

### 2. `lib/lifecycle.ts` — public-payload reason mapping

```ts
export type PublicCompletionReason = 'closed' | 'max_responses' | 'expired'

export function mapClosureReasonForPayload(
  reason: ReturnType<typeof getSurveyClosureReason>,
): PublicCompletionReason | null {
  if (reason === 'full') return 'max_responses'
  return reason  // 'closed' | 'expired' | null
}
```

Decoupling internal `'full'` from public `'max_responses'` lets us evolve internal naming without touching the API contract again. Also matches what the webhook will use in Phase 2.

### 3. `next_check_hint_seconds` heuristic

Pure function, easy to unit-think-through. Place in `lib/results.ts` (or `lib/check-hint.ts` if results.ts gets crowded):

```ts
export function computeNextCheckHintSeconds(args: {
  isFinal: boolean
  expiresAt: string | null
  recentResponseRate1h: number
}): number | null {
  if (args.isFinal) return null

  const now = Date.now()
  const remainingMs = args.expiresAt
    ? new Date(args.expiresAt).getTime() - now
    : Number.POSITIVE_INFINITY

  if (remainingMs <= 0) return null  // expiry passed; caller should have flipped is_final

  // Cadence based on recent activity
  let baseSec: number
  if (args.recentResponseRate1h >= 6) baseSec = 300       // ≥1 every 10min
  else if (args.recentResponseRate1h >= 1) baseSec = 600  // moderate
  else baseSec = 1800                                      // quiet

  // Cap so agent gets ~4 checks before expiry, floor 60s
  const remainingSec = Number.isFinite(remainingMs)
    ? Math.floor(remainingMs / 1000)
    : Number.POSITIVE_INFINITY

  const expiryCap = Number.isFinite(remainingSec)
    ? Math.max(60, Math.floor(remainingSec / 4))
    : Number.POSITIVE_INFINITY

  return Math.min(baseSec, expiryCap)
}
```

### 4. GET `/api/surveys/[id]/responses` changes

Currently the GET handler:
- Selects `api_key_id, schema` from surveys
- Selects all responses (DESC by created_at)
- Returns `aggregateSurveyResults(...)`

New flow:

```ts
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) return auth

  const { id: surveyId } = await context.params
  const since = new URL(request.url).searchParams.get('since_response_id')

  try {
    // Pull lifecycle fields too
    const surveyRows = (await sql`
      SELECT api_key_id, schema, status, response_count, max_responses, expires_at
      FROM surveys
      WHERE id = ${surveyId}
      LIMIT 1
    `) as Array<{
      api_key_id: string | null
      schema: unknown
      status: string
      response_count: number
      max_responses: number | null
      expires_at: string | null
    }>

    const surveyRow = surveyRows[0]
    if (!surveyRow) return notFound()
    if (surveyRow.api_key_id !== auth.keyId) return forbidden()

    const responseRows = (await sql`
      SELECT id, answers, created_at
      FROM responses
      WHERE survey_id = ${surveyId}
      ORDER BY created_at DESC, id DESC
    `) as Array<{ id: string; answers: unknown; created_at: string }>

    const allResponses = responseRows.map((row) => ({
      ...row,
      answers: parseJsonValue<Record<string, ResponseAnswerValue>>(row.answers),
    }))

    // Cursor filter (only when caller supplies it; preserves backward compat)
    let filteredRaw = allResponses
    if (since) {
      const cursorRow = allResponses.find((r) => r.id === since)
      if (cursorRow) {
        filteredRaw = allResponses.filter(
          (r) =>
            r.created_at > cursorRow.created_at ||
            (r.created_at === cursorRow.created_at && r.id > cursorRow.id),
        )
      }
      // If `since` doesn't match any row, behave as if not provided.
    }

    // Closure
    const closureReason = getSurveyClosureReason(surveyRow)
    const isFinal = closureReason !== null
    const completionReason = mapClosureReasonForPayload(closureReason)

    // Recent rate (skip query if isFinal — no hint needed)
    let nextCheckHintSeconds: number | null = null
    if (!isFinal) {
      const rateRows = (await sql`
        SELECT COUNT(*)::int AS count
        FROM responses
        WHERE survey_id = ${surveyId}
          AND created_at > now() - interval '1 hour'
      `) as Array<{ count: number }>
      const rate1h = rateRows[0]?.count ?? 0
      nextCheckHintSeconds = computeNextCheckHintSeconds({
        isFinal,
        expiresAt: surveyRow.expires_at,
        recentResponseRate1h: rate1h,
      })
    }

    return NextResponse.json(
      buildResultsPayload({
        survey: parseJsonValue<Survey>(surveyRow.schema),
        allResponses,
        filteredRaw,
        isFinal,
        completionReason,
        nextCheckHintSeconds,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Performance note:** the recent-rate query runs only when `!isFinal`. For closed surveys, no extra query. Index `idx_responses_survey` already exists, but the `created_at > ...` predicate may want a more specific index. Defer until measured.

### 5. MCP `get_results` — accept cursor, format new fields

Changes:

- New optional input arg: `since_response_id`
- After GET, format includes `is_final` / `completion_reason` / `next_check_hint_seconds` / `next_cursor`

Pseudodiff in `packages/mcp-server/src/index.ts`:

```ts
inputSchema: {
  survey_id: z.string().min(1).describe(...),
  since_response_id: z.string().optional().describe(
    'Optional. Pass the next_cursor from a previous get_results call to fetch only responses received since then. ' +
    'Use this to incrementally consume long-running surveys without re-reading old data.'
  ),
},
async ({ survey_id, since_response_id }) => {
  // ...
  const url = new URL(`${API_BASE_URL}/api/surveys/${encodeURIComponent(survey_id)}/responses`)
  if (since_response_id) url.searchParams.set('since_response_id', since_response_id)
  const responsesResponse = await fetch(url, { headers: { Authorization: ... } })
  // ...
}
```

Update `formatResultsSummary` signature to accept new fields, append them to output:

```
Survey: <title> | Status: open | 47 responses
Recommended next check: ~10 minutes
Next cursor (pass to since_response_id next call): resp_abc

Q0. (...) ...
```

When `is_final`:

```
Survey: <title> | Status: closed (reason: expired) | 47 responses
Collection complete. Act on these results.
```

Bump version literal `'0.3.1'` → `'0.5.0'` and `package.json` `0.4.0` → `0.5.0`. (Skipping 0.4.x because 0.4.0 was the embed-aware ship; 0.5.0 = async-loop-aware. Phase 2/3 won't change MCP further.)

**Don't publish to npm in this phase** — final task does the publish after all 3 phases are merged.

---

## Audit before coding (pre-flight)

Already done as part of writing this plan. Findings:

- `aggregateSurveyResults` is called in only one place: `app/api/surveys/[id]/responses/route.ts`. No other consumers of `raw`.
- The survey results page (owner UI) — confirm via grep that it doesn't fetch this endpoint with assumptions about `raw` being a fixed length. (To verify in implementation step.)
- `getSurveyClosureReason` returns `'closed' | 'expired' | 'full' | null`. The `'full'` literal is internal; nothing in the API currently leaks it.

---

## Acceptance test

Manual verification on Vercel preview:

1. **Cursor returns nothing on cold call**
   - Create survey via API, no responses.
   - `GET /api/surveys/{id}/responses` → `count: 0, raw: [], is_final: false, next_check_hint_seconds: 1800, next_cursor: null`.

2. **Without cursor, full raw**
   - Post 5 responses.
   - `GET /api/surveys/{id}/responses` → `count: 5, raw: [r5, r4, r3, r2, r1]`, `next_cursor: r5.id`.

3. **With cursor at r5, empty raw**
   - `GET /api/surveys/{id}/responses?since_response_id=r5_id` → `count: 5` (still full count), `raw: []`, `next_cursor: r5.id` (unchanged).

4. **With cursor at r3, partial raw**
   - `GET /api/surveys/{id}/responses?since_response_id=r3_id` → `raw: [r5, r4]`.

5. **Stale cursor falls back to full**
   - Pass a non-existent id → `raw` is full set.

6. **Final state on closure**
   - Close survey. `GET /api/surveys/{id}/responses` → `is_final: true, completion_reason: 'closed', next_check_hint_seconds: null`.

7. **Hint cadence**
   - Open survey, no responses in last hour → `next_check_hint_seconds: 1800`.
   - Burst 6+ responses in <1 hour → next call returns `300`.

8. **Hint capped by expiry**
   - Survey with `expires_at` 2 minutes from now, no recent activity → hint = 60s (clamp to floor since `floor(120/4) = 30 < 60`).

9. **MCP shows new lines**
   - From Claude Code, `get_results(survey_id)` shows recommended next check + cursor.
   - `get_results(survey_id, since_response_id=...)` returns same survey state with filtered raw count.

---

## Risks

- **Schema-shape break for the owner UI.** If `/r/{id}` page (results dashboard) consumes the responses endpoint and assumes `raw` is full set, cursor mode would break it — but cursor mode is opt-in, so default behavior is preserved. Audit during implementation.
- **`completion_reason` rename `'full'` → `'max_responses'`.** Internal helper still returns `'full'`; only the public payload remaps. Webhook in Phase 2 will use the same public name. No churn after Phase 1.
- **Recent-rate query overhead.** ~1ms with index, fires once per `get_results`. Acceptable. If observed to dominate, cache `count_in_last_hour` as a column updated on insert.

---

## Done when

- `pnpm --filter web build` passes.
- `pnpm --filter humansurvey-mcp build` passes.
- Manual test cases 1–9 pass on Vercel preview.
- Two reviews completed (correctness + agent-DX).
- Single commit on `feat/async-results-loop` with message `feat(api): cursor reads + is_final + next_check_hint_seconds for async agent loop`.
