# About HumanSurvey

Canonical: https://www.humansurvey.co/about

A reference page rather than a pitch. Everything below is checkable against a shipped surface, and the surface is named beside the claim. Where something is not built yet, it says so.

---

## What it is

**HumanSurvey is an open-source self-reported attribution service: it asks one question — how did you hear about us — inside a host's own signup or payment flow, records the answer at the granularity of a specific creator, show or event, and returns it over an HTTP API instead of a dashboard.**

It is not a survey tool and cannot be configured into one. One single-select question with one optional follow-up is the entire expressive range. The general survey engine — five question types, a Markdown authoring syntax, a conditional logic engine, the `/api/surveys` endpoints — was deleted on 2026-07-30 when the product narrowed to attribution. Every breaking change of that pivot is listed at https://www.humansurvey.co/changelog

## The problem: which channels are invisible, and to what

A browser sends a `Referer` header when one page links to another. Several of the places people actually discover things never produce one:

- **In-app browsers.** A link tapped inside TikTok, Instagram or a mobile app opens in an embedded webview that usually sends no referrer, so the arrival is indistinguishable from someone typing the domain.
- **Spoken and offline exposure.** A podcast read, a conference talk, a booth conversation. There is no link to lose — the person hears a name and types it in days later.
- **Private rooms.** A Slack group, a Discord, a group chat, a forwarded DM. The exposure happens somewhere no analytics has an account, and the link is often re-pasted with its parameters stripped.
- **AI assistants.** ChatGPT, Claude, Perplexity and Gemini send no referrer, and frequently there is no click at all: the person reads your name in an answer and then searches for it, so the visit is credited to search.
- **Word of mouth.** One person telling another. No transport exists for tracking to attach to.

What analytics does with all of them is the same thing: files them under `Direct` / `(none)` / `(not set)`, in one bucket alongside people typing the domain from memory and people clicking a bookmark. The bucket is not labelled "unknown". It is labelled with a channel name, which is why it gets read as one.

There is a second half to the problem that survives even when a referrer does arrive. `tiktok.com` is a platform, not a decision. If six ambassador accounts are running, the platform name collapses all six into one string, and the question a budget holder actually has — which of the six — is not answerable from it. The same applies to which podcast, which subreddit, which conference.

## How it works

1. **Get a key.** `POST /api/auth/code` mails a six-digit code to an address you control, and `POST /api/auth/verify` with `grant: "api_key"` exchanges it for an `hs_sk_...` key. That is the only time the key is readable — only its hash is stored. Anonymous key creation does not exist.
2. **Create a form.** `POST /api/attribution/forms` returns an id and a respondent URL at `/s/{id}`. A form is a placement, not a study — one per place you ask.
3. **Configure it.** `PUT /api/attribution/forms/{id}` takes `nodes`: the question prompt, the candidate list, whether free text is allowed, and which candidates expand a follow-up. Platform rows can be sourced from the product-owned catalog at `GET /api/attribution/catalog` — 39 entries today, each with a label, a mark or monogram, and search aliases. Creator, show and event rows come from you, because resolving a vague memory to a specific person is upstream work this product does not do. Each PUT stores an immutable config snapshot with its own version number, so a candidate list edited this month never rewrites what last month's rollup says was shown.
4. **Embed it.** The host drops an iframe pointing at `/s/{id}?embed=1` into its own signup or payment flow and passes its own user id as `external_id`. The frame posts `mounting`, `loaded`, `resize`, `submitted` and `completed` messages to the parent window. Two placements answer different questions: the payment flow gives you channel against revenue with no conversion plumbing, and the signup flow is the only way to see the people a channel sends who never pay.
5. **The respondent answers.** The first selection is a `POST` and is durable the moment it lands. The follow-up expands in place and arrives as a `PATCH` into the same response, authorised by a one-time token returned from the POST. Candidate order is randomised per respondent by default, "I don't remember" is pinned last and always visible, and skipping is allowed.
6. **Read the answers.** `GET /api/attribution/rollup` returns per-candidate counts and shares for a form and a date window, each share beside the denominator it was computed over, plus the unresolved buckets. `?since_seq=` on the responses route is a cursor read — one row per person, deltas only, and a row becomes visible only once it is complete or has been swept, so nothing is emitted twice. `?external_id=` looks up one identity. Free text is stored verbatim and can be mapped to a candidate months later, retroactively.

The same loop as a sequence of calls:

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

These are decisions, not a backlog. Each one is enforced somewhere in the API, and asking for it back changes what the product is.

- **No dashboard.** There is no human-facing analytics UI, and none is planned. The aggregates are an API resource and your agent is the reader. The signed-in area covers accounts and keys only — no candidate editor, no results table.
- **No multi-touch modelling.** Nothing here distributes fractional credit across a path. There is one self-reported answer per person, and the rollup counts answers.
- **No last touch.** The question is where you *first* heard about us, and there is deliberately no second question about what finally converted you. Last touch is near-constant — people search the brand name — so it buys no media decision worth the completion rate a second framing costs.
- **No outbound contact with respondents.** The service returns a URL and an iframe that renders it. It never emails, messages or otherwise contacts a respondent, and there is no email blast, no auto-posting and no SMS. Getting the question in front of people is the host's job, through a flow the host already owns.
- **No identity resolution.** It renders the candidate list you supply and returns the id that was chosen. Matching "the one who does the office skits" to a person is your side of the line — you do it once as a remap, and it then applies to every past window.
- **No cross-site tracking.** The respondent page collects nothing about the person: no name, no email, no fingerprint, and no free-text question that could be repurposed to ask for one. The only thing that can identify a response is the `external_id` the host chooses to pass. Leave it out and the response is anonymous.
- **No form builder.** No NPS, no CSAT, no rating scales, no matrix questions, no multi-select, no open-ended research. Multi-select in particular is not a missing feature: "select all that apply" means select everything, which means no signal. How this differs from Typeform, Google Forms and SurveyMonkey is answered at https://www.humansurvey.co/faq
- **No form lifecycle.** No `max_responses`, no `expires_at`, no closing. An attribution form sits in a payment flow for months, so it is a perpetual stream. Status is `active` or `paused`, and pausing is reversible. Bounded windows live on the read side instead: the rollup takes `from` and `to`.
- **No theme editor.** `theme` accepts four tokens — `accent`, `radius`, `font` and `dark_mode` — and rejects unknown keys. There is no CSS or HTML plugin surface. A bounded set of parameters is a requirement of embedding in someone else's checkout; a GUI for authoring them is not.
- **No direct Stripe or AppsFlyer integration.** Conversion events are pushed by the caller to `POST /api/attribution/events`, batched and idempotent. The schema is shaped the way a direct integration would want it, so adding one later is additive.

## Limitations: what is genuinely limited, and what is not built

The first item is inherent to the method and will never be fixed. The rest are current state, and each is observable in a response body today.

- **Self-report is memory, not behaviour.** It records what a person says they remember, and no amount of tooling converts that into what they did. Recall decays, and asking late in a flow means asking only the people who stayed — which systematically under-counts any channel whose users leave early. Ask early within the flow for that reason.
- **Calibration is not computed.** The way to know how much self-report under-counts is to compare it against a channel that has its own console reporting ground truth. That is the design, and it is not implemented: `calibration` comes back from the rollup as an explicit `null` rather than an estimate.
- **`share_corrected` and `position_effect` are null too.** Options shown earlier in a list are chosen more often. Under the default `rotate` order every option spends equal expected time at every position, so the raw share is unbiased by construction and no correction is needed — but a caller who chooses `fixed` order gets no correction and no measured magnitude of the effect. Both fields return `null` rather than a smoothed guess.
- **`external_id` is host-asserted.** It is whatever string the host page passes in. The service does not verify that it identifies anyone, and it is not backfillable — a response collected without one can never be joined to a user later. It is deliberately not unique, so a retake is allowed; the rollup counts the first response per `(form_id, external_id)`.
- **The per-response webhook does not deliver.** `per_response_webhook_url` is accepted, validated and stored, and nothing sends to it yet. Use the cursor read until that changes, and do not build on the field.
- **Rendered is treated as seen.** The impressions map counts an option as shown if it was rendered, including below the fold. That is a known approximation in the position model, which is part of why its output ships with its sample size rather than on its own.
- **The MCP package is current.** `humansurvey-mcp` is published on npm at 1.x and its nine attribution tools match the live API. Versions below 1.0.0 are the pre-pivot build calling deleted `/api/surveys` routes; they are deprecated but a stale lockfile can still resolve one.

## Versus a DIY "how did you hear about us" field

A text input or a `<select>` on your own signup form, writing to your own database. This is the honest competitor, and for a lot of situations it is the right one.

**Where the DIY field wins:** it costs nothing, ships in an afternoon, adds no vendor and no third-party frame to a checkout, and the answers stay in a table you already own. If a person is going to read the answers, and there are few enough answers for a person to read, reach for the text field. This product would be overhead.

**Where it stops being enough:**

- Free text arrives spelled every way a person can spell it, and nothing groups it. Someone re-buckets by hand each month, and last month's buckets are not reproducible.
- A hand-written option list has one fixed order for everybody, and options near the top are chosen more often. Sort it by media spend and the data confirms the budget that produced the ordering.
- Skips and "I don't remember" usually disappear rather than being counted, so the shares have no honest denominator.
- Nothing joins an answer to revenue unless you build that join, and nothing follows up to turn "TikTok" into which account.
- A mapping you work out in month three does not apply to months one and two, because the free text was already bucketed by hand.

The machinery in this product is those five things plus the question. If none of them is a problem you have, the field is the better tool.

## Versus multi-touch attribution platforms

Multi-touch attribution platforms observe touchpoints — clicks, pixel fires, ad platform callbacks, sessions — along a person's path and distribute fractional credit across them using a model such as linear, time decay or a fitted data-driven one.

**Where they are stronger, plainly:** they record behaviour rather than memory, they count repeated exposures, they work at session resolution rather than one answer per person, and they connect to ad spend to produce a cost per acquisition. For channels that emit clicks and fire pixels, they are more accurate than asking, and nothing here replaces them.

**Where the two do not meet:** a model can only assign credit among the touchpoints in its input. An exposure that produced no click and no referrer — a podcast read, a message in a private Discord, a name mentioned in an assistant's answer — is not a touchpoint it can see. It does not come back as unknown; that person's credit is distributed across whatever the model did observe, which is often the branded search that came afterwards. Self-report is the opposite trade: one low-resolution, memory-based data point per person, which can name a channel no pixel recorded.

So they are complements rather than substitutes. If every channel you run has a click and a pixel behind it, you do not need this. If a large share of your signups lands in Direct and someone is about to make a budget decision on the rest, a model over the observable part cannot tell you what is in the unobservable part — only the person can.

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

The site and the API are one Next.js application, backed by Postgres. The respondent form, the marketing pages and the endpoints all ship from the same repository, and the schema migrations live in it alongside them.

## Pricing

Open source under MIT, and currently free to use at reasonable volumes. There are no paid plans, no published price list and no billing code in the repository today. Stating a tier table here would be inventing one.

The intended model, written down before the first invoice rather than after: the billable unit will be responses collected, on volume tiers rather than feature tiers, attached to the account — the email address you verify to get a key. A response that answered the channel question and abandoned the follow-up counts, because the channel is known and that is real data. Feature gating forces an upgrade decision; volume gating follows growth instead. When pricing lands it will be announced up front rather than appearing on an invoice.

Because it is MIT-licensed, self-hosting is always available as an alternative to whatever the hosted service eventually charges.

## Where to go next

- Endpoints and the embed contract: https://www.humansurvey.co/docs
- The questions buyers actually ask: https://www.humansurvey.co/faq
- Four worked configurations: https://www.humansurvey.co/use-cases
- What changed when: https://www.humansurvey.co/changelog
- Agent-readable overview: https://www.humansurvey.co/llms.txt
