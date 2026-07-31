# About HumanSurvey

Canonical: https://www.humansurvey.co/about

Every claim below names the shipped surface it is checkable against. Where something is not built yet, it says so.

---

## What it is

**HumanSurvey is an open-source self-reported attribution service: it asks one question — how did you hear about us — inside a host's own signup or payment flow, records the answer at the granularity of a specific creator, show or event, and returns it over an HTTP API instead of a dashboard.**

It is not a survey tool and cannot be configured into one: one single-select question with one optional follow-up is the entire expressive range. The general survey engine and its `/api/surveys` endpoints were deleted on 2026-07-30, when the product narrowed to attribution — https://www.humansurvey.co/changelog

## The problem: which channels are invisible, and to what

A browser sends a `Referer` header when one page links to another. Several of the places people actually discover things never produce one:

- **In-app browsers.** A link tapped inside TikTok or Instagram opens in a webview that usually sends no referrer.
- **Spoken and offline exposure.** A podcast read, a conference talk, a booth conversation. There is no link to lose — the person hears a name and types it in days later.
- **Private rooms.** A Slack group, a Discord, a forwarded DM. The link is often re-pasted with its parameters stripped.
- **AI assistants.** ChatGPT, Claude, Perplexity and Gemini send no referrer, and frequently there is no click at all: the person reads your name in an answer and then searches for it, so the visit is credited to search.
- **Word of mouth.** One person telling another. No transport exists for tracking to attach to.

Analytics files all of them under `Direct` / `(none)` / `(not set)`, alongside people typing the domain from memory. The bucket is not labelled "unknown". It is labelled with a channel name, which is why it gets read as one.

The second half of the problem survives even when a referrer does arrive. `tiktok.com` is a platform, not a decision. If six ambassador accounts are running, the platform name collapses all six into one string, and the question a budget holder has — which of the six — is not answerable from it.

## How it works

You create one form for each place you ask — a form is a placement, not a study — and then:

1. **Configure it.** The prompt, the candidate list, and which candidates expand a follow-up. Platform rows can come from the catalog at `GET /api/attribution/catalog`, 39 entries today; creator, show and event rows come from you. Each PUT stores an immutable snapshot, so a list edited this month never rewrites what last month's rollup says was shown.
2. **Embed it.** An iframe at `/s/{id}?embed=1` inside your own signup or payment flow, with your user id passed as `external_id`. Payment gives you channel against revenue with no conversion plumbing; signup is the only way to see the people a channel sends who never pay.
3. **The respondent answers.** Candidate order is randomised per respondent by default, "I don't remember" is pinned last and always visible, and skipping is allowed.
4. **Read the answers.** The rollup returns per-candidate counts and shares for a date window, each share beside the denominator it was computed over, plus the unresolved buckets. Free text is stored verbatim and can be mapped to a candidate months later, retroactively.

The whole loop as a sequence of calls:

```
1. POST /api/auth/code      { email }
   POST /api/auth/verify    { email, code, grant: "api_key" }   -> hs_sk_...
2. GET  /api/attribution/catalog                                # platform slugs + marks
3. POST /api/attribution/forms   { name, allowed_origins }      -> form id + /s/{id}
4. PUT  /api/attribution/forms/{id}   { nodes }                 -> config version
5. host embeds /s/{id}?embed=1&external_id=usr_8812             # signup and/or payment
6. POST /api/attribution/events  { form_id, events: [...] }     # conversion events
7. GET  /api/attribution/rollup?form_id=...&from=&to=
   GET  /api/attribution/forms/{id}/responses?since_seq=...     # row stream, deltas only
8. GET  /api/attribution/forms/{id}/unresolved                  # free text waiting
   POST /api/attribution/forms/{id}/remaps  { node_id, raw, candidate_id }
```

Full request and response shapes: https://www.humansurvey.co/docs and https://www.humansurvey.co/api/openapi.json

## What it does not do

These are decisions, not a backlog, and each is enforced somewhere in the API.

- **No theme editor.** `theme` accepts four tokens — `accent`, `radius`, `font` and `dark_mode` — and rejects unknown keys. There is no CSS or HTML plugin surface: a bounded set of parameters is a requirement of embedding in someone else's checkout.
- **No dashboard.** No human-facing analytics UI, and none is planned. The aggregates are an API resource and your agent is the reader.
- **No multi-touch modelling.** One self-reported answer per person, and the rollup counts answers.
- **No last touch.** The question is where you *first* heard about us. Last touch is near-constant — people search the brand name — so a second question costs completion rate and buys no media decision.
- **No outbound contact with respondents.** The service returns a URL and an iframe that renders it; it never emails, messages or otherwise contacts a respondent. Getting the question in front of people is the host's job.
- **No identity resolution.** It renders the candidate list you supply and returns the id that was chosen. Matching "the one who does the office skits" to a person is your side of the line — you do it once as a remap, and it applies to every past window.
- **No cross-site tracking.** The respondent page collects no name, no email and no fingerprint, and asks no free-text question that could be repurposed to ask for one. The only thing that can identify a response is the `external_id` the host passes. Leave it out and the response is anonymous.
- **No form builder.** No NPS, no CSAT, no rating scales, no multi-select. "Select all that apply" means select everything, which means no signal. How this differs from Typeform, Google Forms and SurveyMonkey: https://www.humansurvey.co/faq
- **No direct Stripe or AppsFlyer integration.** Conversion events are pushed by the caller to `POST /api/attribution/events`, batched and idempotent.

## Limitations: what is genuinely limited, and what is not built

The first item is inherent to the method and will never be fixed. The rest are current state, and each is observable in a response body today.

- **Self-report is memory, not behaviour.** It records what a person says they remember, not what they did. Recall decays, and asking late in a flow means asking only the people who stayed — which under-counts any channel whose users leave early. Ask early in the flow.
- **Calibration is not computed.** Knowing how much self-report under-counts means comparing it against a channel whose own console reports ground truth. That is the design; it is not implemented. `calibration` comes back from the rollup as an explicit `null` rather than an estimate.
- **`share_corrected` and `position_effect` are null too.** Options shown earlier in a list are chosen more often. Under the default `rotate` order every option spends equal expected time at every position, so the raw share is unbiased by construction — but a caller who chooses `fixed` order gets no correction and no measured magnitude of the effect. Both fields return `null` rather than a smoothed guess.
- **`external_id` is host-asserted.** It is whatever string the host page passes in; the service does not verify that it identifies anyone, and it is not backfillable — a response collected without one can never be joined to a user later. It is deliberately not unique, so a retake is allowed; the rollup counts the first response per `(form_id, external_id)`.
- **The per-response webhook does not deliver.** `per_response_webhook_url` is accepted, validated and stored, and nothing sends to it yet. Use the `?since_seq=` read on the responses route; do not build on the field.
- **Rendered is treated as seen.** The impressions map counts an option as shown if it was rendered, including below the fold — a known approximation in the position model.
- **The MCP package is current.** `humansurvey-mcp` is published on npm at 1.x and its ten attribution tools match the live API. Versions below 1.0.0 are the pre-pivot build calling deleted `/api/surveys` routes; they are deprecated but a stale lockfile can still resolve one.

## Versus a DIY "how did you hear about us" field

A text input or a `<select>` on your own signup form, writing to your own database. This is the honest competitor: it costs nothing, ships in an afternoon, adds no third-party frame to a checkout, and the answers stay in a table you already own. If there are few enough answers for a person to read, reach for the text field. This product would be overhead.

**Where it stops being enough:**

- Free text arrives spelled every way a person can spell it, and nothing groups it. Last month's hand-made buckets are not reproducible.
- A hand-written option list has one fixed order for everybody, and options near the top are chosen more often. Sort it by media spend and the data confirms the budget that produced the ordering.
- Skips and "I don't remember" usually disappear rather than being counted, so the shares have no honest denominator.
- Nothing joins an answer to revenue, and nothing follows up to turn "TikTok" into which account.
- A mapping you work out in month three does not apply to months one and two.

The machinery in this product is those five things plus the question.

## Versus multi-touch attribution platforms

Multi-touch attribution platforms observe touchpoints — clicks, pixel fires, ad platform callbacks — along a person's path and distribute fractional credit across them.

**Where they are stronger, plainly:** they record behaviour rather than memory, they count repeated exposures, and they connect to ad spend to produce a cost per acquisition. For channels that emit clicks and fire pixels, they are more accurate than asking, and nothing here replaces them.

**Where the two do not meet:** a model can only assign credit among the touchpoints in its input. An exposure that produced no click and no referrer is not a touchpoint it can see, and it does not come back as unknown — that person's credit is distributed across whatever the model did observe, which is often the branded search that came afterwards.

Self-report is the opposite trade: one low-resolution, memory-based data point per person, which can name a channel no pixel recorded. They are complements, not substitutes. If every channel you run has a click and a pixel behind it, you do not need this.

## Technical facts

| | |
|---|---|
| Licence | MIT. The copyright line reads "HumanSurvey contributors". |
| Repository | https://github.com/sunsiyuan/human-survey |
| npm package | `humansurvey-mcp` — 1.x on npm, matching the current API. |
| MCP server name | `io.github.sunsiyuan/human-survey` |
| API base | `https://www.humansurvey.co/api` |
| Respondent URL | `https://www.humansurvey.co/s/{id}` |
| Machine references | https://www.humansurvey.co/api/openapi.json, https://www.humansurvey.co/llms.txt, https://www.humansurvey.co/llms-full.txt |
| Support | https://github.com/sunsiyuan/human-survey/issues |

The site and the API are one Next.js application backed by Postgres, shipped from one repository.

## Pricing

Open source under MIT, and currently free to use at reasonable volumes. There are no paid plans, no published price list and no billing code in the repository today.

The intended model, for when there is one: responses collected, on volume tiers rather than feature tiers, announced up front rather than appearing on an invoice. Because it is MIT-licensed, self-hosting is always available as an alternative to whatever the hosted service eventually charges.

## Where to go next

- Endpoints and the embed contract: https://www.humansurvey.co/docs
- The questions buyers actually ask: https://www.humansurvey.co/faq
- Four worked configurations: https://www.humansurvey.co/use-cases
- What changed when: https://www.humansurvey.co/changelog
- Agent-readable overview: https://www.humansurvey.co/llms.txt
