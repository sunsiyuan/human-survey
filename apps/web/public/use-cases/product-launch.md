# You posted in six places. The spike came back labelled Direct.

_Use case · Launch day_

Canonical: https://www.humansurvey.co/use-cases/product-launch

A launch is the one traffic event you most want to decompose, and the one your analytics is least able to. The posts you wrote do send referrers. The traffic that converts mostly does not: it arrives after the post was screenshotted into a group chat, quoted by someone with an audience, read in a mail client, or opened in an app. **The only signal that survives all of that is asking, and the only version worth asking gets down to which account's post it was.**

---

## Why launch traffic is the worst-attributed traffic you will ever get

Every mechanism that makes a launch work also strips the evidence that it worked. The reshare is the point — you posted once, and the useful volume came from other people repeating you, in places you cannot instrument. Concretely:

- **The apps send nothing.** An in-app browser on X, LinkedIn or Reddit, and every DM and group chat the link passed through, arrive with no referrer at all.
- **A UTM link only covers the link you placed.** It cannot follow the copy-paste, which on launch day is most of the distribution.
- **The referrers that do arrive name a domain.** `x.com` tells you a launch is happening on X. It cannot tell you that one quote-post did four times the work of your own announcement.
- **Last-click buries the whole thing.** Somebody sees the post on Tuesday and searches your name on Thursday. Analytics credits search. You conclude that SEO launched your product.

So the post-launch question — _which of the six places we posted actually worked_ — is not a hard analytics query. It is unanswerable from analytics, and it is the only question that changes what you do for the next launch.

## The configuration

One form in the signup flow, which is where launch traffic actually lands, and one in the payment flow, which is what settles the argument a month later. Both take the same config.

```json
{
  "nodes": [
    {
      "id": "channel",
      "prompt": "Where did you first hear about us?",
      "candidates": [
        { "id": "producthunt", "catalog_slug": "producthunt" },
        { "id": "hackernews",  "catalog_slug": "hackernews" },
        { "id": "x",           "catalog_slug": "x",        "expands": "x_account" },
        { "id": "substack",    "catalog_slug": "substack", "expands": "newsletter" },
        { "id": "reddit",      "catalog_slug": "reddit" },
        { "id": "linkedin",    "catalog_slug": "linkedin" },
        { "id": "press",       "catalog_slug": "press" },
        { "id": "google",      "catalog_slug": "google" },
        { "id": "friend",      "catalog_slug": "friend" },
        { "id": "dunno", "label": "I don't remember",
          "pinned": "end", "dont_remember": true }
      ]
    },
    {
      "id": "x_account",
      "prompt": "Whose post was it?",
      "candidates": [
        { "id": "x_own", "label": "Our own account", "handle": "@yourco" },
        { "id": "x_1799210044", "label": "Renna", "handle": "@rennacodes",
          "icon_url": "https://cdn.example.com/avatars/renna.jpg",
          "aliases": ["the person who does the teardown threads"] },
        { "id": "x_1662008317", "label": "Soft Launch Weekly",
          "handle": "@softlaunchwk" },
        { "id": "x_account_dunno", "label": "I don't remember whose",
          "pinned": "end", "dont_remember": true }
      ]
    },
    {
      "id": "newsletter",
      "prompt": "Which newsletter?",
      "candidates": [
        { "id": "sub_devtools_digest",  "label": "Devtools Digest" },
        { "id": "sub_pricing_for_saas", "label": "Pricing for SaaS" },
        { "id": "newsletter_dunno", "label": "I don't remember which",
          "pinned": "end", "dont_remember": true }
      ]
    }
  ]
}
```

- **X expands, Product Hunt does not.** A launch on X is six accounts amplifying each other; a launch on Product Hunt is one page. Spend the respondent's one extra click where the answers differ.
- **Ids survive renames; handles do not.** `x_1799210044` is the numeric account id, so the day `@rennacodes` becomes something else, that account's history stays in one piece. `handle` and `icon_url` are what the respondent sees, and they are the fields you expect to edit.
- **Aliases catch the people who remember a description.** "the person who does the teardown threads" is matched by the search box and never displayed, because that is genuinely how the memory is stored.
- **Nothing here can be closed or capped.** There is no expiry and no response limit — the form sits in the flow after the launch is over, which is the only way to see the tail. Status is `active` or `paused`, and pausing is reversible.

## Launch day: read the rows, not the aggregate

Aggregates are the wrong shape while a launch is still happening. Pass the previous cursor back and you get only what has completed since — every row emitted exactly once and final when emitted.

```bash
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/responses\
?since_seq=8412&limit=100" \
  -H "Authorization: Bearer hs_sk_..."
```

```jsonc
// ILLUSTRATIVE — invented responses, to show the shape of the read
{
  "responses": [
    { "id": "gpW1wRLbWBXl", "external_id": "usr_2201", "completion": "finished",
      "awaiting_node_id": null, "metadata": { "placement": "signup" },
      "answers": [
        { "node_id": "channel",   "kind": "candidate", "candidate_id": "x",
          "resolved_label": "X", "position": 4, "selected_via_search": false },
        { "node_id": "x_account", "kind": "candidate", "candidate_id": "x_1799210044",
          "resolved_label": "Renna", "position": 0, "selected_via_search": false }
      ] },
    { "id": "zslBPunuJrDj", "external_id": "usr_2202", "completion": "finished",
      "answers": [
        { "node_id": "channel", "kind": "raw",
          "raw": "saw it in the Rands Leadership slack",
          "candidate_id": null, "resolved_candidate_id": null, "position": null }
      ] }
  ],
  "next_cursor": "8489",
  "has_more": false,
  "open_responses": true,      // someone is mid-answer right now
  "next_check_hint_seconds": 120
}
```

That second row is the reason this read exists. **Somebody typed a Slack group you had not listed** — a channel that would otherwise have arrived as Direct forever, found on the one day you were watching. Free text is stored verbatim and stays mappable, so once you know the group exists you can resolve every past answer that named it and add it to the list for tomorrow.

`next_check_hint_seconds` paces the polling for you: `0` while a page is waiting, `120` while somebody is mid-answer, `3600` once it has gone quiet. Nothing in this API ever reports that collection has finished, because a form in a signup flow never does.

## A week later: the tail is the finding

The single most common mistake in launch attribution is measuring the launch over the window of the launch. Responses are windowed on when they completed, so you can ask the same question of two windows and watch the answer invert.

```
# ILLUSTRATIVE — invented shares, to show what two windows can do to one answer
# launch week
GET /api/attribution/rollup?form_id=…&from=2026-05-12&to=2026-05-19
  producthunt   0.28    x   0.20    hackernews   0.16    google   0.05

# the month after it
GET /api/attribution/rollup?form_id=…&from=2026-05-19&to=2026-06-19
  producthunt   0.09    x   0.11    hackernews   0.21    google   0.18

# Product Hunt was the day. Hacker News and search were the month.
# Close the window on launch day and you conclude the opposite.
```

Product Hunt is a day-shaped channel and Hacker News is a month-shaped one. Neither window is the wrong one to have asked about, which is the trap: only the pair is useful. Then the follow-up node answers the question your own launch retro cannot:

```jsonc
// ILLUSTRATIVE — every figure below is invented, to show the shape of the payload
{
  "denominator": { "completed_responses": 604,
                   "per_node": { "channel": 604, "x_account": 96, "newsletter": 41 } },
  "rows": [
    { "node_id": "channel",   "candidate_id": "x", "label": "X",
      "responses": 121, "share": 0.200 },
    { "node_id": "x_account", "candidate_id": "x_1799210044", "label": "Renna",
      "responses": 51, "share": 0.531 },
    { "node_id": "x_account", "candidate_id": "x_own", "label": "Our own account",
      "responses": 24, "share": 0.250 }
  ],
  "unresolved": { "raw": 22, "dont_remember": 17, "skipped": 4, "per_node": { … } },
  "followup_unresolved": [ { "node_id": "channel", "candidate_id": "x",
                             "follow_node_id": "x_account",
                             "picks": 121, "unresolved": 33, "rate": 0.273 } ]
}
```

Renna's row is `0.531`: 51 of the 96 people who answered that follow-up at all. A bit over half of everyone who got that far named one account, and it is not yours — a concrete decision, who to send the next launch to before you post it, and one that is invisible in a report where all of it reads `x.com`.

Note what the payload will not let you say. Set the 51 against the 24 who picked your own account and you get 68% — "two thirds of our X traffic came from one account" writes itself. It overstates by fifteen points, because it silently drops the twenty-one people who named a third account or could not name one, and it gets there by taking the denominator from the two rows that happened to be printed. `denominator.per_node` ships in every payload so that the base is never the thing a reader has to reconstruct.

`followup_unresolved` at `0.273` is doing its job too: a bit over a quarter of the people who said X never got to a named account — some walked away, some picked *I don't remember whose*, some typed something no remap has resolved yet. On launch day that is expected, and it is why the number ships next to the share instead of being folded into it.

## Then the payment form settles it

A launch produces a signup spike, and a signup spike is not a result. The form in the payment flow answers the same question against people who paid, so the response joins to revenue with no conversion tracking to build.

Comparing the two placements is the whole point. **Divide a channel's share of the paying population by its share of the signup population. Above 1 it converts better than your average, below 1 worse. Multiply that ratio by your overall signup-to-paid rate to get the channel's own rate.** Launch channels are where those two shares are most likely to diverge — the platform that sent the most signups on launch day need not be the one that sent the most customers, and whether it was is a question no incumbent answers, because none of them ask twice.

Both placements are ideally early in their flow. Asking at the end means asking only the people who got to the end, which under-counts every channel whose users bounce — and a launch channel is the most likely one to be sending exactly those people.

## Getting started

Sign in at https://www.humansurvey.co, copy a key, hand it to your agent, and describe the launch.

> "We launch Tuesday on Product Hunt, Hacker News, X, LinkedIn and two newsletters. Put a how-did-you-hear-about-us question in signup and in checkout, and when someone picks X ask whether it was us, @rennacodes or @softlaunchwk."

Your agent creates both forms, writes the candidate lists and hands back the URLs to embed. On Wednesday: _"what has come in since last night?"_ A month later: _"which of them produced customers rather than signups?"_

What this is not: a post-launch feedback form. It does not ask what people think of the product, what to build next, or whether they would pay $29 — there is one question here, and it is where they came from.

## More

- Docs — form config, the embed contract, cursor reads, the rollup: https://www.humansurvey.co/docs
- Community attribution — Reddit, Discord, Slack groups, and which community it was: https://www.humansurvey.co/use-cases/community-feedback
- Event attribution — conferences and trade shows, and which of the eight it was: https://www.humansurvey.co/use-cases/events
- AI assistant attribution — ChatGPT, Claude, Perplexity and Gemini, which all arrive as Direct: https://www.humansurvey.co/use-cases/ai-assistants
- FAQ — anonymity, what a form can and cannot ask, pricing: https://www.humansurvey.co/faq
