# HumanSurvey

**Website:** [humansurvey.co](https://www.humansurvey.co) · **Docs:** [humansurvey.co/docs](https://www.humansurvey.co/docs) · **FAQ:** [humansurvey.co/faq](https://www.humansurvey.co/faq)

[![human-survey MCP server](https://glama.ai/mcp/servers/sunsiyuan/human-survey/badges/card.svg)](https://glama.ai/mcp/servers/sunsiyuan/human-survey)

Attribution for the channels that have no referrer.

HumanSurvey asks one question — how did you hear about us — inside the host's own signup or
payment flow, at a granularity that is actually actionable: the platform first, then which
creator, podcast, event or store.

```text
Agent configures a form   → platforms from the catalog, creators supplied by the caller
Host embeds /s/{id}       → in its signup flow, its payment flow, or both
Respondent answers        → picks a platform; that pick expands the follow-up in place
Host pushes conversions   → POST /api/attribution/events, keyed on its own user id
Agent reads back          → rollup, raw response stream, free text awaiting a mapping
```

## What is this?

An API and MCP server for self-reported attribution. TikTok in-app, Instagram, podcasts,
communities, word of mouth, AI assistants: the exposure happens where tracking cannot
reach, and asking a human is the only always-on signal that survives every referrer leak.

Two placements answer different questions. In the payment flow, the respondent is already
a paying customer, so the answer joins to revenue with no conversion ingest at all. In the
signup flow, it is the only way to see the people a channel sends who never pay. Divide a
channel's share of the paying population by its share of the signup population. Above 1 it
converts better than your average, below 1 worse. Multiply that ratio by your overall
signup-to-paid rate to get the channel's own rate.

It is designed for:
- hosts embedding a form in their own onboarding or checkout
- agents that keep the candidate list current and read the results back

It is not designed for:
- general-purpose surveys — arbitrary question types, Markdown authoring and conditional
  logic were removed in the attribution pivot
- a human-facing analytics dashboard: the aggregates are an API resource, and the agent is
  the dashboard
- reaching your audience for you — HumanSurvey never contacts respondents; the transports
  it offers (the `/s/{id}` URL and the iframe embed) are ones you control

## Features

- **Progressive disclosure, not pagination** — POST the platform answer, PATCH the
  follow-up. The first answer is durable before the second is asked, and a respondent who
  abandons the follow-up is still real data.
- **Rotation by default** — the orderable candidates are permuted per respondent, seeded
  by a client-minted `render_id`, so the raw share is unbiased by construction. `fixed`
  order exists for callers who want it and does not hide its bias.
- **Retroactive remapping** — free text is stored verbatim and resolved against the remap
  table on every read, so one mapping fixes months of history with no backfill.
- **Immutable config snapshots** — a response is joined to the version it was rendered
  against, so reconfiguring cannot rewrite what history says was shown.
- **One join key, both directions** — `external_id` brings revenue in and carries
  per-user attribution back out to your own user table.
- **Cursor reads** — a response becomes visible once it is complete, is emitted exactly
  once, and is final when emitted. Nothing downstream has to upsert.

## Product Principles

- **AI-first I/O**: agents configure the form and consume the results; humans are in the middle.
- **Everything is an API**: creator functionality must be available over authenticated HTTP and MCP.
- **Narrow scope wins**: one question, asked well. A feature that mainly serves a human survey operator probably does not belong here.
- **No confident percentages**: every number ships beside the denominator it was computed over, and a number we cannot compute honestly is null rather than smoothed.

## Quick Start

### Get an API key

```bash
curl -X POST https://www.humansurvey.co/api/auth/code \
  -H "Content-Type: application/json" \
  -d '{ "email": "you@example.com" }'

curl -X POST https://www.humansurvey.co/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{ "email": "you@example.com", "code": "481920", "grant": "api_key" }'
```

Anonymous key creation is gone. Every key belongs to an account from birth, which is what
gives a lost key a recovery path and makes rotation free.

### Create a form, then configure it

```bash
curl -X POST https://www.humansurvey.co/api/attribution/forms \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout — how did you hear about us",
    "allowed_origins": ["https://app.example.com"]
  }'
```

```json
{
  "id": "abc123efgh45",
  "form_url": "https://www.humansurvey.co/s/abc123efgh45",
  "warnings": ["this form has no config yet; PUT /api/attribution/forms/abc123efgh45 with {nodes} before embedding it"]
}
```

A form renders nothing until it has a config. `PUT` stores one as an immutable snapshot:

```bash
curl -X PUT https://www.humansurvey.co/api/attribution/forms/abc123efgh45 \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [
      {
        "id": "channel",
        "prompt": "Where did you first hear about us?",
        "candidates": [
          { "id": "tiktok", "catalog_slug": "tiktok", "expands": "creator" },
          { "id": "reddit", "catalog_slug": "reddit" },
          { "id": "friend", "label": "A friend or colleague" },
          { "id": "dunno", "label": "I don'\''t remember", "pinned": "end", "dont_remember": true }
        ]
      },
      {
        "id": "creator",
        "prompt": "Which account was it?",
        "candidates": [
          { "id": "oecuid_8812", "label": "Jade", "handle": "@jade.work0" }
        ]
      }
    ]
  }'
```

Platform labels, marks and aliases come from `GET /api/attribution/catalog` and are copied
into the snapshot. Creator candidates are yours: the product renders a candidate set and
returns the id that was chosen, and matching a vague description against a creator
database is upstream work.

### Read the results

```bash
curl "https://www.humansurvey.co/api/attribution/rollup?form_id=abc123efgh45&by=candidate&from=2026-07-01&to=2026-08-01" \
  -H "Authorization: Bearer hs_sk_..."
```

Also on the read side: `GET /api/attribution/forms/{id}/responses` (cursor stream, or one
identity via `?external_id=`), `.../unresolved` for free text awaiting a mapping, and
`POST .../remaps` to resolve it retroactively. Full request and response shapes are in
[the OpenAPI document](https://www.humansurvey.co/api/openapi.json).

### Use with Claude Code

```json
{
  "mcpServers": {
    "survey": {
      "command": "npx",
      "args": ["-y", "humansurvey-mcp"],
      "env": {
        "HUMANSURVEY_API_KEY": "hs_sk_your_key_here"
      }
    }
  }
}
```

The server name stays `survey` and the package stays `humansurvey-mcp` — both sit inside
every existing user's config. Its nine tools now speak the attribution API — see
[`packages/mcp-server/README.md`](./packages/mcp-server/README.md). npm publishes separately
from this repo, so the version on npm can lag what is here.

## Public Surface

- Docs page: `https://www.humansurvey.co/docs`
- OpenAPI: `https://www.humansurvey.co/api/openapi.json`
- AI index: `https://www.humansurvey.co/llms.txt`

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js (App Router) |
| Database | Neon (serverless Postgres) |
| Frontend | React + Tailwind CSS |
| MCP Server | @modelcontextprotocol/sdk |
| Deployment | Vercel |

## Project Structure

```
├── apps/web/            # Next.js app (API + respondent page + site)
│   ├── lib/attribution/ # config, responses, reads, rollup, remap
│   └── supabase/migrations/  # applied through scripts/migrate.sh, with a ledger
├── packages/mcp-server/ # MCP server for Claude Code
└── docs/                # architecture, roadmap, design docs
```

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR. The most important rule is scope discipline: new UI variants, analytics dashboards, and human-operator features are usually out of scope.

## Development

```bash
pnpm install
pnpm dev               # Start Next.js dev server
pnpm test              # node --test over apps/web/lib/**/*.test.ts
pnpm build             # Build all packages
```

## License

MIT
