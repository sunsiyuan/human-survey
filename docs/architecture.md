# Architecture

HumanSurvey measures the channels that have no referrer — down to the person and the piece
of content. A host embeds a two-question form at the moment that matters (payment, then
signup), respondents recognize a logo and then a face, and the host's agent reads the
aggregate back as structured data.

Design contract and the reasoning behind every decision below:
[`design/attribution-pivot.md`](./design/attribution-pivot.md).

## System overview

```
┌──────────────┐      ┌───────────────────┐      ┌─────────────────────┐
│ the host's   │─MCP─▶│  MCP server       │─API─▶│  Next.js on Vercel  │
│ agent        │      │  (local process)  │      │                     │
└──────────────┘      └───────────────────┘      │  ┌─── API routes    │
                                                  │  ├─── /s/{id} form │
       ┌──────────────┐                            │  └─── docs / llms  │
       │ respondent   │──────── /s/{id} ──────────▶│                    │
       │ (in an       │◀── postMessage ───────────│                    │
       │  iframe)     │                            └────────┬───────────┘
       └──────────────┘                                     │
                                                     ┌──────▼──────┐
                                                     │    Neon     │
                                                     │  Postgres   │
                                                     └─────────────┘
```

1. An agent creates a form and configures its candidate sets.
2. The host embeds `/s/{id}` in a flow they own. The form asks one question, and expands a
   follow-up in place when the answer warrants one.
3. Respondents answer over months. The form is perpetual; there is no terminal state.
4. The agent reads the rollup, resolves free text to candidates, and retunes the config on
   a monthly cadence.

## Architecture principles

- **Recognition, not reading.** Platform logos, then creator avatars. The whole design
  rests on a respondent scanning rather than comprehending, because completion rate
  multiplies every number the product produces.
- **The product renders candidates; it does not resolve identities.** Who is on the list,
  and on what basis, is the caller's business.
- **One source of truth per fact.** The most expensive bugs in this codebase were all two
  computations of the same thing that could disagree — the rendered position map, the
  escape-hatch semantics, the pinned-row rule. Each was fixed by deleting one side, not by
  aligning them.
- **Compute at read time.** Nothing is pre-aggregated and `raw` is never discarded, which
  is what lets one retroactive mapping correct two months of history.
- **Every number ships with what it needs to be trusted.** A share ships its denominator; a
  correction that cannot be computed ships as an explicit null rather than a smoothed
  guess.
- **The agent is the dashboard for analysis; the site is the dashboard for debugging.**
  Aggregates are an API resource. A response log is not — see [Read surface](#read-surface).

## Main components

### Web app (`apps/web`)

**Creator API** — `Authorization: Bearer hs_sk_…`, except the three key routes, which also
accept the browser session cookie (`requireAccount` in `lib/auth.ts`). That exception exists
because the page whose job is to hand out a visitor's first key cannot require a key:

| Route | Purpose |
|---|---|
| `POST /api/auth/code`, `POST /api/auth/verify` | six-digit email code → a session or an API key |
| `GET/POST /api/keys`, `DELETE /api/keys/{id}` | key management, scoped to the account |
| `POST/GET /api/attribution/forms` | create and list forms |
| `GET/PUT/PATCH /api/attribution/forms/{id}` | read, configure (`PUT`), settings (`PATCH`) |
| `GET /api/attribution/forms/{id}/responses` | cursor reads, and `?external_id=` identity lookup |
| `GET /api/attribution/forms/{id}/unresolved` | free text awaiting a mapping |
| `GET/POST /api/attribution/forms/{id}/remaps`, `DELETE .../{remapId}` | the remap loop |
| `GET /api/attribution/rollup` | the aggregate |
| `POST /api/attribution/events` | conversion events, single or batch |

**Public routes** — no key, because a respondent has none:

| Route | Purpose |
|---|---|
| `POST/PATCH /api/attribution/forms/{id}/responses` | the respondent write path |
| `GET /api/attribution/catalog` | the platform catalog, for discovery |
| `/s/{id}` | the form itself |
| `/openapi.json`, `/llms.txt`, `/llms-full.txt` | discoverability for developers and agents |

`PATCH` on the respondent path requires the one-time `patch_token` that `POST` returned.
`404` conflates "no such form" with "not your form" on every authenticated route, so a key
cannot be used to walk the id space.

### MCP server (`packages/mcp-server`)

A thin authenticated client over the API, at 1.0.0 with nine tools: `login`, `get_catalog`,
`list_forms`, `get_form`, `create_form`, `configure_form`, `get_attribution`,
`list_unresolved`, `remap`. The five survey-era tools are gone with the API they called.

Publishing is manual and separate from deploying, so the version on npm can lag this repo.

The tool descriptions are the product's primary interface, not documentation of it: what a
description says is what the model believes about the world. A description that names a
downstream tool teaches the model that the two always go together.

### Read surface

Two different jobs, deliberately not one:

- **Analysis** is an API/MCP resource. There is no charts page, and the agent is expected to
  write the monthly note.
- **Debugging** is a response log — "did anything arrive, and what did it say". Without it
  the first-run experience is to embed a form, wait, and have no idea whether it works.
  This is the one place the "no dashboard" principle was wrong and had to be narrowed.

## Data model

Live schema: [`../apps/web/supabase/migrations/001_init.sql`](../apps/web/supabase/migrations/001_init.sql),
which is the authority — it carries the reasoning for each load-bearing column inline.
Migrations are applied by `scripts/migrate.sh` against a `schema_migrations` ledger with
checksum drift detection.

```
accounts ──┬── api_keys                 keys are credentials; accounts own the data
           ├── sessions
           └── attribution_forms ──┬── attribution_configs   IMMUTABLE snapshots
                                    │        └── attribution_responses
                                    │                 └── attribution_answers
                                    ├── attribution_remaps    retroactive, revocable
                                    ├── attribution_events    conversion ingest
                                    └── attribution_anchors   calibration ground truth
login_codes                          six-digit codes, attempt-limited
```

Four things here look like bookkeeping and are not:

- **`attribution_configs` rows are immutable**, enforced by a trigger. A config version is
  a snapshot of what a respondent was shown; label and icon are copied in rather than
  joined live, so nothing later can rewrite what an old rollup claims was rendered.
- **`attribution_forms.response_count` exists for its row lock.** The completion trigger
  updates it *before* calling `nextval`, and that ordering is the only thing making commit
  order match `completed_seq` order. Reverse the two statements and cursor reads silently
  strand rows.
- **`completed_seq` is the cursor token, not `seq`.** `seq` is insert order on a table whose
  rows become final later, so a cursor over it delivers the first answer and never the
  follow-up.
- **`attribution_answers.raw` is verbatim**, with `raw_normalized` generated in the
  database so the write path and the remap lookup cannot drift apart.

Every child FK cascades from `accounts`, so an erasure request is one `DELETE`. The
pre-pivot schema could not do this, which is why key revocation had to be a soft delete.

## Testing

`pnpm test` — `node --test`, no framework. Coverage is deliberately narrow and aimed at the
invariants that fail *silently*: the config content hash (a change switches off the position
correction with no error), the ordering permutation and its positional uniformity, and
candidate ids that collide with `Object.prototype`.

`scripts/schema-smoke.sql` checks fourteen schema invariants inside a transaction it rolls
back, so it is safe to run against production.
