# The booth sent them. Analytics says they found you on Google.

_Use case · Conferences and trade shows_

Canonical: https://www.humansurvey.co/use-cases/events

Events are the most expensive thing on the marketing plan and the worst tracked. There is no referrer to lose here, because there was never a click: someone talked to you at a booth, took a sticker, and signed up nine days later by typing your name into a browser. **Search or Direct takes the credit, which is worse than no answer — it looks like an answer.**

---

## Why this is the hardest channel you spend on

- **There is no digital trace at all.** Not a stripped referrer, not a missing UTM — nothing. The exposure happened in a conversation. A badge scan tells you who you talked to, not who came back.
- **A QR code only measures the people who scanned it at the booth.** The ones who scan on the spot are usually collecting the giveaway. The ones who actually buy do it later, from a laptop, after talking to their team.
- **The gap is days or weeks.** By the time they sign up, every session-scoped attribution model has expired the event out of existence.
- **"Events" is not a channel you can act on.** A company running eight a year signs for the next one six months in advance, and the decision is _which_ — the flagship conference, the regional one, or the dinner for twenty people that cost a twentieth as much.

So the highest cost per lead in the plan is defended, every year, with an argument rather than a number. That is what makes this the most valuable place to simply ask.

A sponsored podcast episode has the same shape and takes the same configuration: no link to lose, a spoken name typed in days later, and a memory of the _show_ rather than the app it was played in. Swap the event list for a show list and everything below is unchanged.

## The configuration

One form in the payment or upgrade flow, one in the signup flow. The channel list includes the non-digital rows that no analytics tool has any equivalent of, and `event` is the one that expands.

```json
{
  "nodes": [
    {
      "id": "channel",
      "prompt": "Where did you first hear about us?",
      "candidates": [
        { "id": "event", "catalog_slug": "event", "expands": "which_event" },
        { "id": "friend",            "catalog_slug": "friend" },
        { "id": "coworker-internal", "catalog_slug": "coworker-internal" },
        { "id": "linkedin",          "catalog_slug": "linkedin" },
        { "id": "press",             "catalog_slug": "press" },
        { "id": "email",             "catalog_slug": "email" },
        { "id": "ad",                "catalog_slug": "ad" },
        { "id": "google",            "catalog_slug": "google" },
        { "id": "chatgpt",           "catalog_slug": "chatgpt" },
        { "id": "dunno", "label": "I don't remember",
          "pinned": "end", "dont_remember": true }
      ]
    },
    {
      "id": "which_event",
      "prompt": "Which one?",
      "candidates": [
        { "id": "evt_kubecon_eu_2026", "label": "KubeCon EU 2026",
          "aliases": ["kubecon london"] },
        { "id": "evt_reinvent_2025", "label": "AWS re:Invent 2025",
          "aliases": ["reinvent", "las vegas"] },
        { "id": "evt_devopsdays_nyc_2026", "label": "DevOpsDays NYC 2026" },
        { "id": "evt_saastr_2026", "label": "SaaStr Annual 2026" },
        { "id": "evt_london_dinner_2026_03", "label": "Our London dinner, March 2026",
          "aliases": ["the dinner"] },
        { "id": "which_event_dunno", "label": "I don't remember which",
          "pinned": "end", "dont_remember": true }
      ]
    }
  ]
}
```

- **Event ids carry the edition, deliberately.** A creator id must survive a rename; an event id must _not_ merge two instances, because you buy the booth once per instance and the 2027 renewal is a separate decision from the 2026 one. Ids are yours and validated, never minted, so this is your call to make.
- **Your own field events belong on the list.** A dinner for twenty is a channel. It has no platform, no console and no row in any analytics product — and it is frequently the line with the best return, which you will never discover if the only option is "a conference".
- **Aliases are how people actually name events.** Nobody says "KubeCon EU 2026"; they say "the one in London". Aliases are matched by the search box and never displayed, so the list stays clean while the matching stays generous.
- **Prune it as the year moves.** Once an event is two quarters behind you, its row is costing every respondent reading time. Dropping it is a config edit, and it is safe: each config is an immutable snapshot, so removing a candidate never rewrites what an older response says was on screen.

## Reading it back, and the window that trips people up

Window the read wide. The window filters on when the _response_ completed, not on when the event happened, so a KubeCon conversation in April shows up in whatever month that person finally signed up.

```bash
# a wide window, because the answer arrives long after the event
curl "https://www.humansurvey.co/api/attribution/rollup\
?form_id=abc123efgh45&by=candidate&metric=revenue&from=2026-01-01&to=2026-07-01" \
  -H "Authorization: Bearer hs_sk_..."
```

```jsonc
{
  "window": { "from": "2026-01-01T00:00:00.000Z", "to": "2026-07-01T00:00:00.000Z",
              "basis": "response.completed_at", "bounds": "[from, to)" },
  "denominator": { "completed_responses": 1146,
                   "per_node": { "channel": 1146, "which_event": 202 } },
  "rows": [
    { "node_id": "channel", "candidate_id": "event",
      "label": "At a conference or event",
      "responses": 231, "share": 0.202,
      "revenue_cents": 8742000, "paying_responses": 214 },

    { "node_id": "which_event", "candidate_id": "evt_kubecon_eu_2026",
      "label": "KubeCon EU 2026", "responses": 74, "share": 0.366,
      "revenue_cents": null },
    { "node_id": "which_event", "candidate_id": "evt_reinvent_2025",
      "label": "AWS re:Invent 2025", "responses": 46, "share": 0.228,
      "revenue_cents": null },
    { "node_id": "which_event", "candidate_id": "evt_london_dinner_2026_03",
      "label": "Our London dinner, March 2026", "responses": 39, "share": 0.193,
      "revenue_cents": null },
    { "node_id": "which_event", "candidate_id": "evt_saastr_2026",
      "label": "SaaStr Annual 2026", "responses": 21, "share": 0.104,
      "revenue_cents": null }
  ],
  "followup_unresolved": [ { "node_id": "channel", "candidate_id": "event",
                             "follow_node_id": "which_event",
                             "picks": 231, "unresolved": 39, "rate": 0.169 } ]
}
```

The London dinner beat SaaStr Annual on customers produced, at a fraction of the cost. That is the finding this whole page exists for, and it is one row of a follow-up question — collapsed into "At a conference or event", it does not exist.

Revenue joins for free at the payment placement: the respondent has just paid, so pushing your own `paid` events keyed on the same user id turns heads into money. **Payment date does not have to fall inside the window** — a September payment is summed against the channel the response recorded in July, which is exactly the behaviour a channel with a long lag needs.

## Revenue per event needs one join

Read the row above carefully: `revenue_cents` is reported on the channel node and is `null` on the event rows. That is not an oversight. A response's money belongs to the response, so booking it on every node the person answered would multiply your total by the number of questions asked — and `null` is used rather than `0`, because zero would be a claim.

So the rollup tells you how many customers each event produced, and revenue per event is one join away, on an id you already own:

```bash
# revenue per event: take the rows and join on your own user id
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/responses\
?since_seq=0&limit=500" \
  -H "Authorization: Bearer hs_sk_..."
# each row carries external_id plus its answers:
#   { "external_id": "usr_4410", "completion": "finished",
#     "answers": [ { "node_id": "channel",     "candidate_id": "event" },
#                  { "node_id": "which_event", "candidate_id": "evt_kubecon_eu_2026" } ] }

# or one person at a time, to stamp the event onto their user record
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/responses\
?external_id=usr_4410" \
  -H "Authorization: Bearer hs_sk_..."
```

The second form is the more interesting one long-term: it makes the event a property of a user record rather than a line in a monthly report, which is what lets sales open an account and see _we met these people at KubeCon_.

## People will type the event name. That is fine.

There is no _Other_ option — if the event is not listed, they type it, and the text is stored verbatim rather than normalized on the way in. For events this happens more than anywhere else, because the thing people remember is a city and a month.

```bash
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/unresolved" \
  -H "Authorization: Bearer hs_sk_..."
# → { "entries": [ { "node_id": "which_event", "raw_normalized": "the london thing",
#                    "occurrences": 6, "variants": ["the London thing", "London dinner?"] } ], … }

curl -X POST https://www.humansurvey.co/api/attribution/forms/abc123efgh45/remaps \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"node_id": "which_event", "raw": "the london thing",
       "candidate_id": "evt_london_dinner_2026_03"}'
# → 201 { "resolved_responses": 6,
#          "candidate_label": "Our London dinner, March 2026" }
```

The mapping is retroactive and revocable: nothing about the stored responses changes, and the rollup resolves free text against the live table on every read. So one row fixes six months of history at once — which matters here more than anywhere, because an event's answers arrive over a season, not a week.

## What the two placements tell you about an expensive booth

Events are the inverse of a viral channel: low volume, high value. The form in the signup flow shows a small share; the form in the payment flow shows a much larger one.

**That gap is the argument for the booth** — a channel's share among payers versus its share among signups is its signup-to-paid rate, and events routinely win that comparison by a distance while losing on raw volume. Run one placement only and you get the half of the picture that makes your best channel look small.

Ask early in each flow. Asking at the end of onboarding means asking only the people who finished, and a channel whose leads take three weeks to activate is the one most likely to be missing from that population.

## Getting started

Sign in at https://www.humansurvey.co, copy a key, and hand it to your agent with your event calendar.

> "Add a how-did-you-hear-about-us question to signup and to checkout. When someone says they met us at an event, ask which: KubeCon EU 2026, re:Invent 2025, DevOpsDays NYC, SaaStr, and our London dinner in March. Keep last year's events in the list until June."

Your agent creates the forms, writes the candidate lists, and hands back the URLs to embed. Before the next sponsorship deadline: _"how many customers came from each event, and what did they pay?"_

What this is not: a post-event feedback form. It does not rate sessions, poll attendees or collect speaker feedback — there is one question here, asked of your own users inside your own product, and it is where they first heard about you.

## More

- Docs — form config, the embed contract, cursor reads, the rollup: https://www.humansurvey.co/docs
- Community attribution — Reddit, Discord, Slack groups, and which community it was: https://www.humansurvey.co/use-cases/community-feedback
- Launch attribution — Product Hunt, Hacker News, X, and the spike that lands as Direct: https://www.humansurvey.co/use-cases/product-launch
- AI assistant attribution — ChatGPT, Claude, Perplexity and Gemini, which all arrive as Direct: https://www.humansurvey.co/use-cases/ai-assistants
- FAQ — anonymity, what a form can and cannot ask, pricing: https://www.humansurvey.co/faq
