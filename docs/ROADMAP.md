# Roadmap

Public roadmap for HumanSurvey. Organized by **distribution form** (how a human reaches the form) on one axis, and **agent-side primitives** (how an agent runs the loop) as an orthogonal axis.

For per-feature design rationale, see [`docs/design/`](./design/). For the user-facing API reference, see [`/docs`](https://www.humansurvey.co/docs).

---

## Distribution form

### L0 — Public share URL ✅ shipped

Hosted `/s/{id}` page anyone can fill out. Free, always free.

**Pain it solves:** "I want a link I can send to people."
**Customer:** community manager, indie maker testing an idea, event organizer.

### L1 — Iframe embed ✅ shipped (2026-04-27)

Customer drops an `<iframe>` into their own page (landing page, onboarding step, in-app form). Per-response webhook delivers lead data to the host's CRM endpoint.

**Pain it solves:** "I want my onboarding flow to collect a structured lead, and the data needs to land in my CRM."
**Customer:** indie maker, SaaS PM, growth-engineer-at-startup.
**Pricing:** free.

Capabilities:
- `?embed=1` strips page chrome.
- `postMessage` events from iframe to parent: `loaded`, `submitted`, `resize`.
- Per-response webhook → host's CRM.
- `respondent_metadata` JSONB (UTM, host's user_id, plan, etc.).
- `respondent_external_id` for host-side dedup.
- Prefill via URL params.

Detailed design: [`docs/design/l1-embed-plan.md`](./design/l1-embed-plan.md).

### L2 — Headless SDK 💵 future paid tier

`npm i @humansurvey/react` (or vue / vanilla / react-native). Host fetches schema from public `GET /api/surveys/{id}`, renders with their own components, submits via the same `POST /api/surveys/{id}/responses` endpoint as iframe.

**Why a paid tier (in brief):** SDK customers (strict-brand-guideline companies, native mobile apps, deeply embedded onboarding) self-select as higher willingness-to-pay and don't overlap with the free-iframe pool, so gating SDK doesn't cannibalize free.

**When to start building:** L1 has multiple active hosts AND at least one is asking for headless. Don't pre-build.

Tier shape and pricing decisions are tracked privately and will be announced when L2 is closer to ship.

---

## Agent-side primitives (orthogonal axis)

Independent of distribution form (L0/L1/L2). About making the agent loop ergonomic when surveys return over hours/days.

### Async results loop ✅ shipped (2026-04-30)

Three primitives shipped together:

- **Cursor reads** — `GET /api/surveys/{id}/responses?since_response_id=…` plus `is_final`, `completion_reason`, `next_check_hint_seconds`, `next_cursor` in the payload. Agents fetch only deltas, know when to stop checking, and get a server-side advisory cadence.
- **Expired webhook + atomic fire-once** — completion webhook now fires on all three terminal events (manual / max / expired) with `event_id` for idempotency. Fire-once is enforced by atomic UPDATE on a dedicated column.
- **Threshold notification** — optional `notify_at_responses` field; same `webhook_url` receives an `event: 'threshold_reached'` payload (status stays open) so the agent wakes on "enough signal" without waiting for closure.

Detailed design: [`docs/design/async-results-loop.md`](./design/async-results-loop.md). Per-phase plans: [`async-results-loop-phase{1,2,3}.md`](./design/).

**Why this mattered:** L1 embed shipped, but the next thing that distinguishes "feedback infra for agents" from "form builder with API" is whether the agent can sleep through the response window and be cleanly woken. Pre-Phase-2 the webhook didn't fire on expired; pre-Phase-1 the results endpoint dumped everything every time. Both fixed.

---

## API stability for L2

Decisions that are right at L1 ship-time so L2 doesn't require breaking changes:

1. `GET /api/surveys/{id}` is public, returns minimal schema for rendering: `{id, title, schema, status, ended_reason?}`. No `api_key_id`, no `webhook_url`, no `response_count`. Both iframe and future SDK consume this.
2. `POST /api/surveys/{id}/responses` body shape: `{answers, metadata?, external_id?}`. Same shape for iframe and SDK.
3. `response_id` is server-generated (`nanoid(12)`), client never supplies one.

If L1 ships with these three locked in, L2 is "thin npm wrapper around two endpoints" — ~200 LOC, no rewrite.

---

## Out of scope, permanently

Not "later" — explicitly not on the roadmap:

- Visual theme editor / brand-customization GUI
- A/B testing
- Conversion-funnel analytics
- WYSIWYG form designer
- Result-analytics dashboard for survey owners (read via API/MCP)
- Email / SMS / Slack outbound to respondents — distribution is the host/user's job, never the service's
- `/vs/{competitor}` marketing pages

## Out of scope, for now (might come back)

- Webhook retry / DLQ / signing secret — only when a real "we lost a webhook" incident demands it
- Custom domain / white-label — Pro feature candidate, build only when paying customer asks
- Multi-language UI — niche, defer
- `embed.js` standalone bundle (modal/popover JS widget) — only if iframe-only proves insufficient for a real host
- Captcha / rate limit / embed token — only after observed abuse, not on roadmap
