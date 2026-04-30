# L1 embed — detailed implementation plan

Concrete plan for shipping iframe embed (L1 in `product-roadmap.md`). ~5 working days end-to-end. All paths are in the main repo unless noted.

## Files this touches

| Path | Role |
|------|------|
| `apps/web/app/s/[id]/page.tsx` | Survey render entrypoint; reads `?embed=1` |
| `apps/web/app/layout.tsx` | Site chrome; needs to be skip-able in embed mode |
| `apps/web/components/survey/SurveyForm.tsx` | The form; emits postMessage in embed mode, reads prefill / metadata / external_id from URL |
| `apps/web/app/api/surveys/[id]/route.ts` | Survey GET; needs an unauthenticated public branch |
| `apps/web/app/api/surveys/[id]/responses/route.ts` | Submission endpoint; accepts `metadata` and `external_id`; fires per-response webhook |
| `apps/web/app/api/surveys/route.ts` | Survey CREATE; accepts optional `per_response_webhook_url` |
| `apps/web/lib/webhook.ts` | Reused for per-response webhook fire |
| `apps/web/lib/db.ts` (or migrations) | New columns: `responses.respondent_metadata`, `responses.respondent_external_id`, `surveys.per_response_webhook_url` |
| `packages/mcp-server/src/index.ts` | MCP `create_survey` tool gains `per_response_webhook_url` arg |
| `apps/web/app/docs/page.tsx` | Embed integration docs section |

## Phase 1 — minimum viable embed (~1 day)

**Goal:** any host can drop an `<iframe>` into their page, and they know when it submitted, with the form fitting their layout.

### 1.1 Embed mode rendering

- `apps/web/app/s/[id]/page.tsx`: read `searchParams.embed`. If `embed === '1'`, pass `embedded={true}` down.
- In embedded mode, render only `<SurveyForm />` — no site header, no footer, no page gradient. Background transparent so host's page color shows through.
- Verify `next.config.ts` doesn't set `X-Frame-Options: DENY` (it doesn't currently). No `frame-ancestors` config needed for v1 — Vercel default is permissive.

### 1.2 postMessage events from iframe to parent

In `SurveyForm.tsx` when `embedded`:
- On mount: `window.parent.postMessage({source:'humansurvey', type:'loaded', surveyId}, '*')`
- After successful submit (POST returns 201): `window.parent.postMessage({source:'humansurvey', type:'submitted', surveyId, responseId, answers}, '*')`
- `ResizeObserver` on form root → on size change: `window.parent.postMessage({source:'humansurvey', type:'resize', surveyId, height}, '*')`

Use `source: 'humansurvey'` discriminator so host's listener can filter.

### 1.3 Embed integration docs

In `apps/web/app/docs/page.tsx` (or new `/docs/embed` section), show a copy-paste snippet:

```html
<iframe id="hs-survey"
        src="https://www.humansurvey.co/s/abc123?embed=1"
        style="width:100%; border:0;"></iframe>
<script>
  window.addEventListener('message', e => {
    if (e.data?.source !== 'humansurvey') return;
    const f = document.getElementById('hs-survey');
    if (e.data.type === 'resize') f.style.height = e.data.height + 'px';
    if (e.data.type === 'submitted') {
      // route the user, hide the form, fire your analytics — your call
      console.log('lead captured:', e.data.responseId, e.data.answers);
    }
  });
</script>
```

### 1.4 Acceptance check

- Stand up a static HTML fixture page with the snippet, point at a real Vercel preview. Fill, submit. Verify in browser console: `loaded` → `resize` (matches form height, no inner scroll) → `submitted` with response_id and answers.

**No DB migration in Phase 1.**

## Phase 2 — lead-capture pain points (~3 days)

**Goal:** lead data + UTM + host's user_id arrives in the host's CRM webhook, with optional prefill so the user doesn't re-type things the host already knows.

### 2.1 DB schema changes

```sql
ALTER TABLE responses ADD COLUMN respondent_metadata JSONB;
ALTER TABLE responses ADD COLUMN respondent_external_id TEXT;
CREATE INDEX responses_external_id_idx ON responses (survey_id, respondent_external_id);
ALTER TABLE surveys ADD COLUMN per_response_webhook_url TEXT;
```

**Deliberate omissions:**
- No `UNIQUE` on `(survey_id, respondent_external_id)`. Retake behavior is a business call we don't yet have a customer for.
- No `allowed_origins` column. iframe doesn't need POST-CORS; SDK does, and SDK is L2.
- No `embed_settings` JSONB. Query-string config is enough for v1.

### 2.2 Public survey GET

`GET /api/surveys/[id]` is currently owner-authenticated. Both iframe (Phase 1 already needs this implicitly via the page route SSR — but the SDK will need it as an HTTP call) and future SDK need a public read.

- Same route, branch on auth:
  - No auth header → return `{id, title, schema, status, ended_reason?}` only. No `api_key_id`, no `webhook_url`, no `response_count`, no `per_response_webhook_url`.
  - Valid auth + matches `api_key_id` → return full row as today.
- This is the contract `product-roadmap.md` calls out as "API stability for L2."

### 2.3 POST /responses accepts metadata + external_id

In `apps/web/app/api/surveys/[id]/responses/route.ts`:
- Body shape: `{answers, metadata?, external_id?}`.
- Validate:
  - `metadata` must be plain object, max ~4KB JSON serialized. Reject if not.
  - `external_id` must be string, ≤ 200 chars. Reject if not.
- Insert: `INSERT INTO responses (id, survey_id, answers, respondent_metadata, respondent_external_id) VALUES (...)`.

### 2.4 Per-response webhook

After successful insert, if `survey.per_response_webhook_url` is set, fire:

```ts
fireWebhook(survey.per_response_webhook_url, {
  survey_id: surveyId,
  response_id: responseId,
  answers,
  metadata,
  external_id,
  submitted_at: new Date().toISOString(),
})
```

Reuses existing `lib/webhook.ts` — fire-and-forget, no retries (deferred until observed need).

### 2.5 SurveyForm reads URL params

In `SurveyForm.tsx`:
- Parse `URLSearchParams`:
  - `prefill[questionId]=value` → seed initial answers state. Only apply for `questionId`s that exist in `survey.schema`; ignore others (don't echo arbitrary host input back into the form).
  - `metadata[key]=value` → bundle into `metadata` on submit body.
  - `external_id=...` → pass as `external_id` on submit body.

Phase 2 prefill is initial-value only. Don't expose prefilled values as visible "the host says you said X" UI — that's a separate UX call.

### 2.6 Survey CREATE accepts per_response_webhook_url

- `POST /api/surveys` body schema gains optional `per_response_webhook_url` (URL string, http/https only).
- MCP `create_survey` tool args mirror this.

### 2.7 Acceptance check

- Create survey via MCP with `per_response_webhook_url=https://webhook.site/xxx`.
- Embed `<iframe src=".../s/abc?embed=1&metadata[utm_source]=hn&external_id=user_42&prefill[email]=test@x.com">`.
- Verify form pre-fills email. Submit.
- webhook.site receives POST with `{survey_id, response_id, answers, metadata: {utm_source: 'hn'}, external_id: 'user_42', submitted_at}`.

## Out of Phase 1 + Phase 2 (do not do now)

- `embed.js` standalone bundle (modal/popover JS widget shape)
- `embed_settings` JSONB column
- `allowed_origins TEXT[]` + CORS allow-list (iframe doesn't need; SDK = L2)
- `redirect` / `callback` / `message+html` success kinds (only postMessage)
- UNIQUE constraint on `respondent_external_id`
- Theme query params (`?accent=...`) — wait until a host complains
- Webhook signing secret / retry / DLQ
- Captcha, rate limit, embed token
- React/Vue SDK packages

## Ship order

| Day | Work |
|-----|------|
| 1 | Phase 1 (1.1, 1.2, 1.3), deploy to Vercel preview, self-test on a static HTML fixture |
| 2 | Phase 2 schema migration + POST /responses extension + per-response webhook (2.1, 2.3, 2.4) |
| 3 | Phase 2 prefill + metadata pass-through in SurveyForm (2.5) |
| 4 | Public survey GET branch (2.2), MCP `create_survey` arg (2.6) |
| 5 | End-to-end acceptance test (2.7), docs polish (1.3 final), buffer |
