# HumanSurvey docs — configure the form, embed it, read the rollup

Canonical: https://www.humansurvey.co/docs

HumanSurvey asks one question — how did you hear about us — at a granularity that is actually actionable. An agent configures the candidate list over HTTP, the form is embedded in a host page, and the same agent reads answers back as a stream of rows or as an aggregate. There is no dashboard: the agent is the dashboard.

Machine-readable references alongside this page: https://www.humansurvey.co/api/openapi.json (OpenAPI 3, also served at `/openapi.json`) and https://www.humansurvey.co/llms-full.txt (the same endpoints plus the caveats that change a number).

---

## Authentication

An account owns the data; a key is a credential pointing at it. Keys look like `hs_sk_...` and go on every creator request as `Authorization: Bearer hs_sk_...`.

There is no anonymous key creation. The first key comes from a six-digit code mailed to an address you control — two calls, no browser required, which is what lets an MCP server write the key straight to its own config instead of returning it into a transcript.

```bash
# 1. mail yourself a six-digit code
curl -X POST https://www.humansurvey.co/api/auth/code \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
# → 202 { "sent": true, "expires_in_seconds": 600 }

# 2. exchange the code for a key
curl -X POST https://www.humansurvey.co/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "code": "482915",
    "grant": "api_key",
    "name": "growth-agent"
  }'
# → 201 { "id": "abc123efgh45", "key": "hs_sk_..." }   ← the only time the key is readable
```

`grant: "api_key"` returns the key. Omit `grant` — or send `grant: "session"` — and you get an `httpOnly` session cookie instead. That is the grant https://www.humansurvey.co/signin posts, and the three key routes below accept that cookie in place of a bearer key so https://www.humansurvey.co/account can issue a first key to someone who does not have one yet. Nothing else accepts it: every attribution route is bearer-only.

### Key management

```bash
# List every key on the account. "current" flags the one you are calling with.
curl https://www.humansurvey.co/api/keys \
  -H "Authorization: Bearer hs_sk_..."

# Mint another key using an existing one — no email round trip
curl -X POST https://www.humansurvey.co/api/keys \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "growth-agent (rotated 2026-07)"}'

# Revoke any key on the account, including one you are not holding
curl -X DELETE https://www.humansurvey.co/api/keys/<key-id> \
  -H "Authorization: Bearer hs_sk_..."
```

- **List** — `GET /api/keys` returns every key on the account (`id`, `name`, `agent_client`, `created_at`, `last_used_at`, `revoked_at`, `current`). Key values are hashed at rest and never returned again. `current` flags the key that authenticated the request, so it is `false` on every row when a session cookie did — there is no key in play to flag.
- **Revoke** — `DELETE /api/keys/{id}` works on any key on the account, not just the one in the header. That is the point: a leaked key can be killed from somewhere safe. Unknown id, another account's key and already-revoked all answer `404`.
- **Rotate** — mint a replacement, move the integration, revoke the old one. Forms and responses belong to the account, so nothing is orphaned by rotation.

## Form config

A form is one placement — typically two per account, one in the signup flow and one in the payment flow. Creating it and configuring it are separate calls, and `PUT` is the only verb that accepts config.

```bash
# 1. create the placement
curl -X POST https://www.humansurvey.co/api/attribution/forms \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "checkout", "allowed_origins": ["https://app.example.com"]}'
# → 201 { "id": "abc123efgh45",
#          "form_url": "https://www.humansurvey.co/s/abc123efgh45",
#          "warnings": ["this form has no config yet; PUT ... with {nodes} before embedding it"] }

# 2. give it a config — PUT snapshots {nodes} and returns the version
curl -X PUT https://www.humansurvey.co/api/attribution/forms/abc123efgh45 \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d @config.json
# → 200 { "id": "abc123efgh45", "version": 7, "created": true, "warnings": [] }

# 3. settings are a different verb — PATCH refuses config keys outright
curl -X PATCH https://www.humansurvey.co/api/attribution/forms/abc123efgh45 \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"theme": {"accent": "#4f46e5", "radius": 12, "dark_mode": "auto"}}'
```

The config is a graph of ask nodes. Both questions are the same component: the first receives platforms, the second receives whatever the first expanded into.

```json
{
  "nodes": [
    {
      "id": "channel",
      "prompt": "Where did you first hear about us?",
      "order": "rotate",
      "allow_free_text": true,
      "candidates": [
        { "id": "tiktok",  "catalog_slug": "tiktok", "expands": "creator" },
        { "id": "chatgpt", "catalog_slug": "chatgpt" },
        { "id": "reddit",  "catalog_slug": "reddit" },
        { "id": "friend",  "catalog_slug": "friend" },
        { "id": "dunno", "label": "I don't remember",
          "pinned": "end", "dont_remember": true }
      ]
    },
    {
      "id": "creator",
      "prompt": "Which account was it?",
      "candidates": [
        { "id": "oecuid_8f21", "label": "Jade", "handle": "@jade.work0",
          "icon_url": "https://cdn.example.com/avatars/jade.jpg",
          "aliases": ["the one who does the office skits"] },
        { "id": "oecuid_1c07", "label": "Tom", "handle": "@transyncai_tom" },
        { "id": "creator_dunno", "label": "I don't remember who",
          "pinned": "end", "dont_remember": true }
      ]
    }
  ]
}
```

- **Candidate ids are yours**, and are validated rather than minted. Use a key that survives a rename — handles change, and a handle used as an id splits that creator's history the day they rename.
- `catalog_slug` copies `label`, `icon_url`, `tile_color` and `aliases` out of the platform catalog at configure time. Anything you send yourself wins. Read the vocabulary from `GET /api/attribution/catalog`, which needs no key.
- `expands` names the node a pick reveals, in place. Exactly one node must be unexpanded — that is the root, and it is derived rather than declared (send `root_node_id` and it is checked against the derived one). Cycles and unreachable nodes are rejected.
- `order` defaults to `"rotate"`: the orderable segment is permuted per respondent, so no option sits at the top for everybody and the raw share is unbiased by construction. `"fixed"` uses your array order verbatim and accepts the position bias that comes with it.
- `pinned: "end"` excludes a candidate from ordering and renders it last. `dont_remember: true` records the pick as a non-answer instead of a channel, and requires `pinned: "end"`. At most one of each per node.
- `aliases` are matched by the search box and never displayed. There is no _Other_ option — `allow_free_text` (default true) lets a respondent type instead.

**Every config is an immutable snapshot.** `PUT` returns a `version`, stored responses are joined against the version they were rendered with, and a reconfigure never rewrites what an older response says was shown. Re-posting identical content returns the existing version with `created: false` — which is deliberate, because a fresh version every month would fragment the position-effect sample.

Validation reports every problem at once, as `{ error, errors: [...] }` with `400`, so an agent does not burn a turn per typo.

### Settings, and the lifecycle

`PATCH` takes `name`, `status`, `allowed_origins`, `theme` and `per_response_webhook_url`. It rejects `nodes` and `root_node_id` with a `400` naming `PUT`, rather than accepting them and silently dropping your candidate list.

- **Status is `active` or `paused`.** There is no open / closed / expired / full lifecycle, no `max_responses` and no `expires_at`: an attribution form is a perpetual stream, not a bounded study. Pausing is reversible, so a POST to a paused form answers `409`, not `410`.
- `allowed_origins` is checked against the host page's origin. An empty list is enforced as allow-all and every write returns a warning saying so, because an unlisted origin embedding your form spends your response quota. Origins only — a path, query or fragment is rejected at configure time rather than silently matching nothing.
- `theme` accepts four tokens and nothing else: `accent` (hex), `radius` (0–48 px), `font` (a font-family list) and `dark_mode` (`light` / `dark` / `auto`). An unknown key is an error, not a shrug. Sending `theme` replaces the stored one wholesale, so `{}` is how you reset it.
- `per_response_webhook_url` is accepted, validated and stored, and **nothing delivers to it yet**. Until it does, use the cursor read below — do not build on the field.

### Limits

| Thing | Limit |
|---|---|
| nodes per form | 12 |
| candidates per node | 500 (12 render; search carries the rest) |
| aliases per candidate | 24 |
| label, prompt, handle, icon_url | 120 characters |
| any id | 128 characters |
| free-text answer | 500 characters — rejected, never truncated |
| allowed_origins | 20 entries |
| response page limit | 1–500, default 100 |
| events per batch | 500 |

## API reference

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/auth/code` | Public | Mail a six-digit sign-in code. 202 either way — it never says whether the address has an account. |
| `POST /api/auth/verify` | Public | Exchange the code for an API key (`grant: "api_key"`) or a browser session cookie (the default). |
| `POST /api/keys` | Bearer key | Mint another key on the same account. No longer public — anonymous key creation is gone. |
| `GET /api/keys` | Bearer key | List every key on the account, with `current` flagging the caller. Key values are never returned. |
| `DELETE /api/keys/{id}` | Bearer key | Revoke any key on the account, including one you are not holding. Soft delete. |
| `POST /api/attribution/forms` | Bearer key | Create a placement. `name` is required; config is a separate call. |
| `GET /api/attribution/forms` | Bearer key | List the account's forms, newest first, each with its `form_url`. |
| `GET /api/attribution/forms/{id}` | Bearer key | The form plus the config snapshot it currently points at. |
| `PUT /api/attribution/forms/{id}` | Bearer key | Send `{nodes}`. Validates, snapshots, returns the version. Identical content dedupes. |
| `PATCH /api/attribution/forms/{id}` | Bearer key | Settings only: `name`, `status`, `allowed_origins`, `theme`, `per_response_webhook_url`. |
| `POST /api/attribution/forms/{id}/responses` | Public | The first selection. Returns `response_id`, `patch_token` and `next_node` if one opens. |
| `PATCH /api/attribution/forms/{id}/responses` | Public | The follow-up. Requires the `patch_token` from the POST. |
| `GET /api/attribution/forms/{id}/responses` | Bearer key | Cursor read (`?since_seq`) or one identity (`?external_id`). Send one or the other, never both. |
| `GET /api/attribution/forms/{id}/unresolved` | Bearer key | Free text awaiting a mapping, grouped and ordered by occurrence count. |
| `GET /api/attribution/forms/{id}/remaps` | Bearer key | Mappings on this form, with the count of responses each one resolves today. |
| `POST /api/attribution/forms/{id}/remaps` | Bearer key | Map free text to a candidate. Applies to every past window at read time. |
| `DELETE /api/attribution/forms/{id}/remaps/{remapId}` | Bearer key | Revoke a mapping. Soft and idempotent — a second call returns `revoked: false`. |
| `GET /api/attribution/rollup` | Bearer key | Aggregates for one `form_id`. Required, and never a union across forms. |
| `POST /api/attribution/events` | Bearer key | Push conversion events keyed on `external_id`. Batched, idempotent, up to 500 per call. |
| `GET /api/attribution/catalog` | Public | The product-owned platform catalog: slugs, labels, marks, monograms, aliases. |

Plus `/s/{id}`, the respondent page — public, unchanged, and the only page a respondent ever sees.

Every route that takes a form id answers `404` for both "no such form" and "not your form". That is not vagueness for its own sake: telling them apart would let anyone holding a key walk the id space.

## Collecting answers

The respondent write path is public on both verbs, because it runs inside a form embedded in someone else's checkout — there is no credential a respondent's browser could hold that would not immediately be a credential every respondent holds. What stands in for auth is per verb: POST is gated on the origin allowlist, PATCH on the one-time token POST hands back.

Submission is progressive. The first pick POSTs and is durable immediately; the follow-up PATCHes. Someone who answers the channel question and walks away has still told you their channel, and that response is billed and counted.

```
POST /api/attribution/forms/{id}/responses          # public
{
  "render_id": "V1StGXR8_Z5j",      // client-minted, before first paint
  "config_version": 7,              // the snapshot that was rendered
  "node_id": "channel",             // must be the root node
  "answer": { "candidate_id": "tiktok" },
  "selected_via_search": false,
  "external_id": "usr_8812",        // your own user id — the join key
  "host_origin": "https://app.example.com",
  "metadata": { "plan": "pro" }
}
→ 201 { "response_id": "xyz789abcd01", "patch_token": "…", "next_node": { … } }

PATCH /api/attribution/forms/{id}/responses         # public, needs patch_token
{
  "response_id": "xyz789abcd01",
  "patch_token": "…",
  "node_id": "creator",
  "answer": { "candidate_id": "oecuid_8f21" }
}
→ 200 { "response_id": "xyz789abcd01", "completed": true }
```

`answer` carries exactly one of four keys. Sending two, or none, is a `400` naming the count.

```
// exactly one key, on both POST and PATCH
{ "candidate_id": "tiktok" }              // a row in the rendered list
{ "raw": "the office skits girl" }        // free text, stored verbatim
{ "dont_remember": true }                 // the pinned escape hatch
{ "skipped": true }                       // skipping is allowed
```

- `render_id` is minted by the client before first paint and is the rotation seed, so a reload is stable. **Send no position data.** The server derives the impressions map and the selected index from `(render_id, config_version, node)` by running the same pure permutation the client rendered with — so neither number can be forged, and no honest submission can be rejected for disagreeing.
- `selected_via_search` stays client-supplied because the server sees the list but not the keystrokes. It only ever suppresses a recorded position, never invents one.
- `external_id` is your own user id, the join key in both directions. It is deliberately not unique — a retake is allowed — and the rollup counts the first response per `(form_id, external_id)`. It is respondent-asserted and not authenticated: it identifies, it does not prove.
- `config_version` tells the server which snapshot was on screen. Omit it and the form's current version is used, which is only right for a client that predates the field — a reconfigure landing between page load and submit would then reject a candidate the respondent was actually shown.
- `host_origin` is the embedding page's origin. The `Origin` header cannot serve here: the iframe is served from our own origin, so every embed is same-origin by construction. Treat this as billing hygiene, not a security boundary — anything in the browser can assert it.
- `patch_token` is good until the response completes, not for exactly one call, so an expansion chain deeper than two levels still works. A second PATCH after completion is `409`.

A response becomes visible to the reads below only once it is complete — or once an abandonment sweep closes it out, which happens lazily on the next authenticated read of that form. Every row is therefore emitted exactly once and is final when emitted, so no consumer has to upsert.

## Embed

Append `?embed=1` to the form URL to render without site chrome, on a transparent full-width container. Ask early in the flow — memory decays, and asking later means asking only the people who stayed.

```html
<iframe id="hs-form"
        src="https://www.humansurvey.co/s/abc123?embed=1&external_id=usr_8812&plan=pro"
        style="width:100%; border:0;"></iframe>
<script>
  window.addEventListener('message', e => {
    if (e.origin !== 'https://www.humansurvey.co') return
    if (e.data?.source !== 'humansurvey') return
    const f = document.getElementById('hs-form')
    if (e.data.type === 'resize') f.style.height = e.data.height + 'px'

    if (e.data.type === 'submitted') {
      // The channel answer is durable. The follow-up may still be on screen —
      // hiding the iframe here cuts the respondent off mid-flow.
      track('hdyhau_channel', e.data.answers)
    }

    if (e.data.type === 'completed') {
      // Now it is safe to route the user or collapse the frame.
    }
  })
</script>
```

Five message types, every one carrying `source: 'humansurvey'` and `formId`:

- `{ type: 'mounting', formId }` — posted by an inline script the instant the iframe HTML is parsed, before React hydrates. Swap a blank spinner for a skeleton during the cold load.
- `{ type: 'loaded', formId }` — hydrated and interactive.
- `{ type: 'resize', formId, height }` — content height changed; size the iframe so there is no inner scrollbar. Deduped, which matters for a searchable list that re-measures on every keystroke.
- `{ type: 'submitted', formId, responseId, answers }` — the first answer is durable. **Not** the end of the flow.
- `{ type: 'completed', formId, responseId, answers }` — the follow-up landed, or the respondent finished in one step. This is the one to route on.

`submitted` and `completed` are separate because progressive submission makes the first answer durable before the form is done. A host that hides the iframe on `submitted` cuts the respondent off mid-question.

### Answer payload

`answers` is keyed by node id and carries the one node that was just answered — the same answer object the write path takes, not a whole-form map.

```json
// e.data.answers on submitted / completed — the one node just answered
{ "channel": { "candidate_id": "tiktok" } }
{ "creator": { "raw": "the office skits girl" } }
{ "channel": { "dont_remember": true } }
```

There is no `::` fill-in encoding any more. Free text is a first-class `raw` answer, so nothing has to be split on a separator.

### Response tagging

Any query param on the form URL that is not reserved is captured and stored as the response's `metadata`, so you can segment by whatever you already know (`?plan=pro&step=checkout`). It surfaces on every row from the cursor read.

- Reserved params, consumed by the page and never stored as tags: `embed`, `external_id`, `host_origin`.
- Sanitized on capture: string and number values only, at most 20 keys, keys truncated to 64 characters and values to 512. Repeated params keep their last value. Responses with no custom params carry `metadata: {}`.

## Cursor reads

`GET /api/attribution/forms/{id}/responses` is the primary read path. A bare call reads from the beginning of the stream, so a first call needs no cursor; pass `next_cursor` back as `since_seq` to get only the delta. `limit` is 1–500, default 100, and an out-of-range value is rejected rather than clamped.

```js
// Re-entry: read only what has completed since the last cursor
const r = await fetch(`${api}/api/attribution/forms/${id}/responses?since_seq=${cursor}`,
  { headers: { Authorization: `Bearer ${key}` } }).then(r => r.json())

act(r.responses)             // only the delta; aggregates live in the rollup
saveCursor(r.next_cursor)    // echoes your cursor when the page is empty

// Nothing here ever says "finished". An attribution form is perpetual.
//   has_more        — a row past this page exists right now (read with LIMIT+1, not guessed)
//   open_responses  — someone is mid-answer, so more is expected shortly
scheduleNextCheck(r.next_check_hint_seconds)   // 0 | 120 | 3600
```

**There is no `is_final`, and there was never a legitimate value for it.** An attribution form is perpetual, so no field may claim a terminal state. Two facts replace it, and both come out of the same snapshot as the page:

- `has_more` — a row past this page exists right now. A fact, not a `rows.length === limit` guess: the page is read with `LIMIT limit + 1` and the extra row dropped.
- `open_responses` — someone answered their first question and has not yet finished or been swept, so more is expected shortly.
- `next_check_hint_seconds` — advisory cadence derived from those two: `0` while a page is waiting, `120` while something is in flight, `3600` once drained.
- `next_cursor` — this page's own last cursor, and it echoes your cursor when the page is empty rather than resetting to null, which would restart the stream from the beginning.

Each row carries `completion` (`finished` or `abandoned`), `awaiting_node_id` (non-null is the row-level coverage read-out), `config_version`, `external_id`, `positions`, `metadata` and its own `cursor`. Each answer carries the verbatim `raw`, the unresolved `candidate_id`, the `resolved_candidate_id` after live remaps, `resolved_via` (`answer` / `remap`), `resolved_label` from the config snapshot, `position` and `selected_via_search`. The unresolved value ships next to the resolved one on purpose: a caller who only ever sees the resolved answer cannot audit a mapping it disagrees with.

### One identity

`?external_id=` is the other read on the same verb — one person's answers, so attribution can be a property of a user record rather than a monthly report. Send `since_seq` or `external_id`, never both: they are two different reads with two different orderings, and a cursor from one is not a cursor into the other.

```bash
# One person, for joining our answer into your own user table
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/responses?external_id=usr_8812" \
  -H "Authorization: Bearer hs_sk_..."
# → { "external_id": "usr_8812", "count": 2, "canonical_response_id": "xyz789abcd01",
#     "has_retakes": true, "truncated": false, "responses": [ … ] }
```

Ordered by `created_at`, and the first row is flagged `canonical` — the one the rollup books revenue against. Retakes are surfaced (`has_retakes`) rather than hidden.

## Free text and remapping

Free text is stored verbatim and never normalized at write time, which is also why there is no `TikTok` bucket sitting beside a `tiktok` one: candidate ids are yours, so nothing is guessed on the way in.

A mapping is not an edit. Nothing about a response changes; the rollup resolves each answer against the live remap table on every read. So one row fixes two months of history at once, and revoking it moves them back.

```bash
# what free text is waiting, most frequent first
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/unresolved?limit=50" \
  -H "Authorization: Bearer hs_sk_..."

# map it — retroactive, no backfill, every past window included
curl -X POST https://www.humansurvey.co/api/attribution/forms/abc123efgh45/remaps \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "creator",
    "raw": "the office skits girl",
    "candidate_id": "oecuid_8f21"
  }'
# → 201 { "remap": {...}, "resolved_responses": 12,
#          "candidate_label": "Jade", "warnings": [] }

# undo it — soft, and equally retroactive
curl -X DELETE https://www.humansurvey.co/api/attribution/forms/abc123efgh45/remaps/<remap-id> \
  -H "Authorization: Bearer hs_sk_..."
# → 200 { "remap": {...}, "revoked": true, "resolved_responses": 12, "notes": [ … ] }
```

- `GET .../unresolved` groups by `(node_id, raw_normalized)` and orders by occurrence count, so the twelve-occurrence entry comes before the singleton. Query: `node_id`, `from`, `to`, `include_mapped`, `limit`, `offset`. The window filters on the response's `completed_at` and `to` is exclusive, matching the rollup, so the same pair reconciles across both.
- On create, send exactly one of `raw` (a verbatim sample straight out of the unresolved list) or `raw_normalized`. Both take the same path — `lower(btrim(...))` evaluated in Postgres, the same function that generated the stored key.
- `resolved_responses` on the create and revoke responses is the exact number of completed responses that just moved, so "I mapped it and nothing changed" is visible immediately instead of next month.
- `candidate_id` is not validated against the current config — a candidate can be dropped while history still needs the mapping — but an id present in no version of the form comes back as a warning, because the likelier cause is a typo.
- A second live mapping of the same string is `409` naming the one already in place, because two live remaps double-count in the read-time join. Revocation is soft and idempotent.

## Conversion events

`POST /api/attribution/events` is the inbound half of the `external_id` join: you push what happened to a person, we already know which channel that person named, and the rollup becomes channel × revenue instead of channel × heads. Caller-pushed on purpose — there is no Stripe or AppsFlyer integration.

```bash
curl -X POST https://www.humansurvey.co/api/attribution/events \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "form_id": "abc123efgh45",
    "events": [
      { "external_id": "usr_8812", "event": "paid", "value_cents": 4900,
        "currency": "USD", "occurred_at": "2026-07-14T09:12:00Z",
        "idempotency_key": "stripe_in_1P9x" },
      { "external_id": "usr_9130", "event": "signup",
        "occurred_at": "2026-07-14T10:01:00Z" }
    ]
  }'
# → 201 { "accepted": 2, "duplicates": 0, "rejected": 0, "results": [ … ],
#          "join_check": { "checked": 2, "matched": 1, "unmatched": 1,
#                          "examples": ["usr_9130"] }, "notes": [ … ] }
```

- Accepts a single event object, a bare array, or `{ form_id, events: [...] }` — an envelope `form_id` is pushed onto each element that omits one. Up to 500 events per call.
- Fields: `form_id`, `external_id`, `event` (`signup` / `activated` / `paid` / `churned`), `occurred_at`, and optionally `value_cents`, `currency`, `idempotency_key`. `value_cents` requires `currency`.
- **One bad row does not fail the batch.** Every element is validated independently and reported at its own index as `created`, `duplicate` or `rejected`, so a 400-payment backfill that trips on row 217 tells you exactly what to resend.
- A replayed `idempotency_key` is a success that says so, and carries a warning when the replayed payload disagrees with what is stored. Reusing one key for two different amounts would otherwise leave every downstream number quietly equal to the first.
- `join_check` reports how many `external_id`s matched a response on that form, with a few unmatched examples. An event for someone who has not answered is legitimate and is not rejected — but "we pushed a month of Stripe data and revenue is still zero" is almost always an id-format mismatch, and this is where it becomes visible.
- Status: `201` when anything was created, `200` when nothing was new but something was a clean replay, `400` when nothing was written, `404` when every rejection named a form this key cannot see.

## Rollup

`GET /api/attribution/rollup` is the aggregate read, computed in SQL at read time against the current remap table. `form_id` is required and there is no union across forms — candidate populations differ per form, so a union would divide one form's selections by another form's respondents.

```bash
curl "https://www.humansurvey.co/api/attribution/rollup\
?form_id=abc123efgh45&by=candidate&metric=revenue&from=2026-07-01&to=2026-08-01" \
  -H "Authorization: Bearer hs_sk_..."
```

`by` is `candidate` (default, one row per node × candidate) or `node`. `metric` chooses the sort, not which columns ship. `from` / `to` filter on the response's `completed_at`, half-open as `[from, to)`; a zoneless timestamp is read as UTC.

```json
// ILLUSTRATIVE — invented figures, shown for shape
{
  "form_id": "abc123efgh45",
  "by": "candidate",
  "metric": "revenue",
  "window": { "from": "…", "to": "…",
              "basis": "response.completed_at", "bounds": "[from, to)" },
  "denominator": { "completed_responses": 1330, "per_node": { "channel": 1330, "creator": 374 } },
  "rows": [
    { "node_id": "channel", "candidate_id": "tiktok", "label": "TikTok",
      "label_from_node_id": null, "responses": 412, "share": 0.31,
      "share_corrected": null, "revenue_cents": 1840000, "paying_responses": 96,
      "resolved_by_remap": 7 }
  ],
  "unresolved": { "raw": 63, "dont_remember": 128, "skipped": 91, "per_node": { … } },
  "followup_unresolved": [ { "node_id": "channel", "candidate_id": "tiktok",
                             "follow_node_id": "creator", "picks": 412,
                             "unresolved": 91, "rate": 0.22 } ],
  "followup_abandoned":  [ { …, "abandoned": 38, "rate": 0.09 } ],
  "revenue": { "total_cents": 3910000, "paying_responses": 204, "event": "paid",
               "currencies": ["USD"], "basis": "first response per (form_id, external_id); …" },
  "position_effect": null,
  "calibration": null,
  "notes": [ … ]
}
```

- **The denominator ships in the payload.** `share` is over every completed response that answered that node, so the resolved rows sum to less than one and the remainder is the `unresolved` block — a reader who has to infer whether 31% excludes the don't-knows will infer wrong.
- Revenue is booked once per response, on the first response per `(form_id, external_id)`, and appears once: totals in the top-level `revenue` block, per-row `revenue_cents` only on the root node's rows and `null` elsewhere. Null rather than zero, because zero would be a claim.
- `followup_unresolved` and `followup_abandoned` are different numbers and both ship. The first is candidate coverage: of the picks that opened a follow-up, the fraction that did not end in a resolved candidate. The second is strictly the fraction that never came back at all. Neither is derivable from the other.
- `share_corrected`, `position_effect` and `calibration` are `null` in v1. Returned as explicit nulls so their absence is visible rather than mysterious.
- Labels come from the config snapshots, never the live catalog, so a product-side rename cannot rewrite what an old rollup says was shown. `label_from_node_id` is set when a label had to be read off another node of the same form, which only happens for a remap target.

## MCP tools

`humansurvey-mcp` on the 1.x line speaks this API. Ten tools: `login`, `get_catalog`, `list_forms`, `get_form`, `create_form`, `configure_form`, `get_attribution`, `list_unresolved`, `remap` and `revoke_remap`. The five survey-era tools were deleted rather than shimmed.

**1.x is published**, so `npx -y humansurvey-mcp` fetches a server whose ten tools match this document. Versions below 1.0.0 are the pre-pivot build, call the removed `/api/surveys` endpoints, and are deprecated on npm — a pinned version or a stale lockfile can still resolve one. The HTTP surface below remains the source of truth either way.

The tool set is shaped as a read-write loop on a monthly cadence rather than configure-once-poll-forever: sign in and store a key, list forms, read the rollup, list unresolved free text, remap it, and reconfigure the candidate list and expansion policy against where the money went this month. Deliberately absent are raw response exports and the identity lookup (a backend job on a schedule, not a conversation's), the conversion-event ingest (that arrives from a payment webhook), and anything destructive.

## Markdown syntax — removed

**This capability no longer exists.** The Markdown survey syntax and the LLM endpoint that translated it are gone, along with the five question types they described (`single_choice`, `multi_choice`, `text`, `scale`, `matrix`) and the whole `/api/surveys` surface. A form is now a JSON graph of ask nodes and candidates, configured with `PUT /api/attribution/forms/{id}` — see Form config above.

## Conditional logic — removed

**This capability no longer exists.** `showIf` and its `eq` / `neq` / `contains` / `answered` operators are gone, as is the `show if:` Markdown block. The one conditional behaviour that survives is candidate expansion: a candidate carrying `expands: "<node id>"` reveals that node in place when it is picked, which is how the follow-up question works — see Form config above.

## More

- FAQ, including where the MCP publish currently stands: https://www.humansurvey.co/faq (markdown: https://www.humansurvey.co/faq.md)
- Use cases — four walkthroughs, one per channel class: https://www.humansurvey.co/use-cases (markdown: https://www.humansurvey.co/use-cases.md)
- Changelog: https://www.humansurvey.co/changelog (markdown: https://www.humansurvey.co/changelog.md)
- OpenAPI: https://www.humansurvey.co/api/openapi.json
- Agent-readable overview: https://www.humansurvey.co/llms.txt — full machine reference: https://www.humansurvey.co/llms-full.txt
