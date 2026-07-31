# Roadmap

Public roadmap for HumanSurvey.

Rewritten 2026-07-30 for the attribution pivot. The previous version organized everything
by **distribution form** (L0 share URL → L1 iframe → L2 headless SDK), an axis that stopped
carrying weight once the product narrowed to one question asked at one moment: the form is
embedded in a flow the host owns, and the share URL is a fallback rather than a tier.

Design rationale for every decision here: [`design/attribution-pivot.md`](./design/attribution-pivot.md).
API reference: [`/docs`](https://www.humansurvey.co/docs).

> **A warning about this file's predecessor, kept because it cost real work.** The old
> version marked L1 "✅ shipped" with six capabilities, three of which had never been built
> — `respondent_external_id`, prefill, and the per-response webhook had zero occurrences
> anywhere in the codebase. A design doc was then written on top of those claims and had to
> be corrected. **Treat "shipped" here as meaning "verified against the code", and if you
> cannot verify it, do not write it.**

---

## Shipped

### The form — ✅ 2026-07-30

`/s/{id}`, embeddable with `?embed=1`. One single-select question, expanding a follow-up in
place when the answer warrants one. Search always present, free text always allowed, the
"I don't remember" escape hatch pinned last and never filtered out. Candidate order is
per-respondent randomized by default. Four theme tokens (accent, radius, font, dark mode).
`postMessage`: `mounting` / `loaded` / `resize` / `submitted` / `completed`.

Verified in a browser end to end, not only in tests.

### Accounts and keys — ✅ 2026-07-30

Six-digit email codes as the only sign-in, serving both the browser and the MCP server —
the second is the point, since it puts a key on disk instead of in an agent transcript.
Accounts own the data and keys are credentials, so rotation no longer orphans anything.
Anonymous key creation is gone.

### MCP 1.0.0 — ✅ 2026-07-30

Nine tools; the five survey-era ones deleted outright rather than shimmed, since the
pre-reset export showed no third-party users to shim for. Tool descriptions and formatted
output are treated as the product surface: no description names another tool, and a share is
never printed without its denominator, because a model handed a bare percentage quotes a bare
percentage. Published to npm as 1.0.0 on 2026-07-31; 1.x is the current line.

### Accounts on the web — ✅ 2026-07-30

`/signin` (six-digit email code) and `/account` (list, issue, revoke keys, and the MCP config
snippet with the key already in it). Deliberately nothing else: keys and later billing. The
moment it grows a results tab it has become the dashboard this product is not.

### The read surface — ✅ 2026-07-30

`GET /api/attribution/rollup` (aggregated in SQL, with the window in the query and the share
denominator shipped beside the shares), cursor reads over `completed_seq`, `?external_id=`
identity lookup, the unresolved list, and the remap loop. `POST /api/attribution/events`
ingests conversion events, single or batched.

---

## Next

1. **Position-effect estimation.** The data capture shipped because it is not backfillable;
   the estimator did not, because it needs volume to return anything but null and the
   default randomized order does not need it. Only `fixed`-mode callers do.
2. **Per-response webhook.** Accepted, validated and stored today; nothing delivers to it.
3. **Calibration anchors.** The table exists. Needs a customer with a channel console and
   real volume.
4. **Billing.** Metered on responses collected, volume tiers rather than feature tiers.
   Deliberately last: nobody has hit a limit.
5. ~~**Publish `humansurvey-mcp`.**~~ Done on 2026-07-31. Both publishes are manual and
   independent of each other and of the deploy: npm and the MCP registry each serve the 1.x
   line. Do not restate a version number here — this line has now been stale twice, and the
   thing worth writing down is that npm and the registry can disagree, not what either says
   today. `npm view humansurvey-mcp version` and the registry's `/v0/servers?search=` answer
   that in a second.

---

## Open questions that want data, not argument

- **The abandonment threshold.** 30 minutes is a placeholder, biased long: too short
  misrecords a slow respondent as an abandoner, and the two are indistinguishable
  afterwards.
- **Whether "I don't remember" should get a second chance** ("roughly which app was it
  in?"). It could recover sample; it could also push genuine non-rememberers into guessing.
  Leaning no. Cheap to A/B.
- **Candidate coverage.** `followup_unresolved` is the read-out. If it runs high, entity
  extraction from free text becomes worth building; if it runs low, it never does.

---

## Out of scope, permanently

- WYSIWYG form designer
- A/B testing as a product surface
- Multi-select answers — "select all that apply" means "select everything", which is no
  attribution signal
- Last-touch questioning — near-constantly "searched your brand name", and carries no
  media-buying decision
- Email / SMS / Slack outbound to respondents. Distribution is the host's job, never the
  service's. This is the one line that has survived every rewrite of this file.
- Resolving free text to a creator on the caller's behalf. The product renders candidates
  and returns the chosen id; identity resolution is upstream work.
- `/vs/{competitor}` pages — comparison content lives in `/faq`.

### Two entries that used to be here and are not

**"Conversion-funnel analytics"** and **"result-analytics dashboard"** were listed as
permanently out of scope, and the rollup is squarely the first of them. The reconciliation:
what stays out is a *human-facing analytics dashboard*. Aggregates ship as an API/MCP
resource and the agent writes the report. A **response log** — "did anything arrive, and
what did it say" — is debugging rather than analysis and is in scope; without it, a first
integration is a black box.

**"Visual theme editor / brand-customization GUI"** stays out, but four theme tokens ship.
A bounded parameter set is a requirement of the embed form factor; a GUI for authoring them
is not. Stated explicitly because the old wording would otherwise read as a broken promise.

## Out of scope, for now

- Custom domain / white-label — build when a paying customer asks
- Multi-language respondent UI
- `embed.js` standalone bundle — only if iframe-only proves insufficient for a real host
- Direct Stripe / AppsFlyer integrations. The pushed event schema is shaped the way one
  would want, so adding one later is additive.
- Signed `external_id`. Today it is a join key asserted by the host, not an authentication
  of who answered — the honest limitation, with the rollup's first-response-per-identity
  rule as the one mitigation that already exists.
- A project layer between accounts and keys. An agency running three clients holds three
  accounts, which is the better arrangement anyway: the customer owns their history and the
  agency holds a key.

### Promoted out of "for now", because shipping changed the argument

**Origin allowlisting** was "only after observed abuse". Under per-response pricing an
unlisted origin embedding your form spends your quota, which makes it billing integrity
rather than abuse prevention. It ships.

**A headless SDK as a paid tier** is cancelled. Volume tiers, not feature tiers: feature
gating forces a customer to make an upgrade decision, while volume gating upgrades them
automatically as they grow.
