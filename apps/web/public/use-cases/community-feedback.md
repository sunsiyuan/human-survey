# "Reddit" is not an answer. r/selfhosted is.

_Use case · Community-led growth_

Canonical: https://www.humansurvey.co/use-cases/community-feedback

Community-led growth is the hardest thing on your dashboard to measure and the cheapest thing you do. A Slack group leaves no trace whatsoever. A Discord link arrives with nothing attached. And where a referrer _does_ survive — Reddit in a desktop browser — it names the platform and stops there. **This page configures the one question that gets past all of it, and gets past it at the granularity of the specific community.**

---

## What actually reaches your analytics

| Path in                            | What arrives              | What you can conclude                                                                                          |
| ---------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Reddit, desktop browser            | `https://www.reddit.com/` | The platform. Browsers trim a cross-origin referrer to the origin by default, so the subreddit is gone before the request leaves. |
| Reddit app, Slack, Discord         | Nothing                   | Direct.                                                                                                        |
| A UTM link you posted              | The campaign you tagged   | Only the link you controlled. Not the reshare, not the DM, not the person who typed your name in three days later. |
| Asking the person                  | `reddit` → `r/selfhosted` | The community. Survives the app, the DM, and the three-day gap.                                                 |

The UTM row is the one worth staring at. It works, and it measures exactly the fraction of community traffic that came through a link you personally placed — which in a healthy community is the minority, because the value of a community is other people repeating you.

## Why the follow-up question is the whole point

Suppose you learn that 33% of your paying customers first heard about you on Reddit. You now know one useful thing and can act on none of it: you cannot post more in "Reddit". The decisions available to you are about specific communities — which subreddit to show up in weekly, which Slack group deserves a person rather than a link, whether r/sysadmin was ever worth the time.

So the form asks twice. Picking Reddit expands a second list in place, no page transition, and the response is durable before the second list even appears. Hacker News does not expand, because there is only one Hacker News and a second question there costs a click and returns nothing. **Which channels earn the follow-up is a monthly judgment, not a fixed property** — that is a config edit, and it is the reason an agent maintains this list rather than a form builder.

## The configuration

A form is one placement. Create it, then `PUT` the candidate list — `catalog_slug` pulls the label, the mark and the search aliases out of the platform catalog so you only type the things that are yours.

```json
{
  "nodes": [
    {
      "id": "channel",
      "prompt": "Where did you first hear about us?",
      "candidates": [
        { "id": "reddit",     "catalog_slug": "reddit", "expands": "subreddit" },
        { "id": "slack",      "catalog_slug": "slack",  "expands": "slack_group" },
        { "id": "hackernews", "catalog_slug": "hackernews" },
        { "id": "discord",    "catalog_slug": "discord" },
        { "id": "github",     "catalog_slug": "github" },
        { "id": "x",          "catalog_slug": "x" },
        { "id": "google",     "catalog_slug": "google" },
        { "id": "chatgpt",    "catalog_slug": "chatgpt" },
        { "id": "friend",     "catalog_slug": "friend" },
        { "id": "dunno", "label": "I don't remember",
          "pinned": "end", "dont_remember": true }
      ]
    },
    {
      "id": "subreddit",
      "prompt": "Which subreddit?",
      "candidates": [
        { "id": "r/selfhosted", "label": "r/selfhosted" },
        { "id": "r/devops",     "label": "r/devops" },
        { "id": "r/kubernetes", "label": "r/kubernetes" },
        { "id": "r/sysadmin",   "label": "r/sysadmin" },
        { "id": "subreddit_dunno", "label": "I don't remember which",
          "pinned": "end", "dont_remember": true }
      ]
    },
    {
      "id": "slack_group",
      "prompt": "Which Slack group?",
      "candidates": [
        { "id": "slack_k8s", "label": "Kubernetes",
          "handle": "kubernetes.slack.com", "aliases": ["k8s slack"] },
        { "id": "slack_dataeng", "label": "Data Engineering",
          "handle": "dataeng.slack.com" },
        { "id": "slack_mlops", "label": "MLOps Community",
          "handle": "mlops-community.slack.com" },
        { "id": "slack_group_dunno", "label": "I don't remember which",
          "pinned": "end", "dont_remember": true }
      ]
    }
  ]
}
```

```bash
curl -X PUT https://www.humansurvey.co/api/attribution/forms/abc123efgh45 \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d @channels.json
# → 200 { "id": "abc123efgh45", "version": 3, "created": true, "warnings": [] }
```

- **Subreddit names are their own stable key.** A subreddit cannot be renamed, so `r/selfhosted` is safe as an id. A Slack group is not — the workspace can be renamed, which is why those ids are internal (`slack_k8s`) and the pretty name lives in `label`. Ids are yours and are validated, never minted, so a rename never splits a community's history in two.
- **A missing community does not cost you one data point.** It contaminates a neighbour: someone who found you in a Slack group and then searched picks Google, so you lose the group and book a false entry against search. Ten to twelve rows with logos scan faster than six rows of text, and `aliases` — matched, never displayed — catch the people who remember a description rather than a name.
- **Order is randomized per respondent by default.** Options near the top get picked more often; rotating means no community sits at the top for everybody, so the raw share is unbiased without any correction being applied to it afterwards.
- **"I don't remember" stays visible and last.** Given a list and a search box, someone who does not remember will pick something, and that is worse than a smaller sample — it is noise wearing the costume of signal.

## What comes back

One aggregate read, computed in SQL at read time. There is no dashboard by design: the agent already in your terminal is the thing that reads this.

```bash
curl "https://www.humansurvey.co/api/attribution/rollup\
?form_id=abc123efgh45&by=candidate&metric=revenue&from=2026-07-01&to=2026-08-01" \
  -H "Authorization: Bearer hs_sk_..."
```

```jsonc
{
  "denominator": { "completed_responses": 512,
                   "per_node": { "channel": 512, "subreddit": 143, "slack_group": 61 } },
  "rows": [
    { "node_id": "channel", "candidate_id": "reddit", "label": "Reddit",
      "responses": 168, "share": 0.328,
      "revenue_cents": 1612000, "paying_responses": 151 },
    { "node_id": "subreddit", "candidate_id": "r/selfhosted", "label": "r/selfhosted",
      "responses": 71, "share": 0.497, "revenue_cents": null },
    { "node_id": "subreddit", "candidate_id": "r/devops", "label": "r/devops",
      "responses": 34, "share": 0.238, "revenue_cents": null }
  ],
  "unresolved": { "raw": 12, "dont_remember": 13, "skipped": 2, "per_node": { … } },
  "followup_unresolved": [ { "node_id": "channel", "candidate_id": "reddit",
                             "follow_node_id": "subreddit",
                             "picks": 168, "unresolved": 33, "rate": 0.196 } ]
}
```

The denominator ships in the payload, so the resolved rows sum to less than one and the remainder is the `unresolved` block. That is deliberate: a reader who has to guess whether 33% already excludes the don't-knows will guess wrong, and in the direction that flatters every channel.

`followup_unresolved` is the number to watch in the first week. It is the share of Reddit picks that never resolved to a subreddit — coverage of your candidate list, reported without your having to instrument anything. High and steady usually means the list is missing the community people actually came from.

## Two placements, and the number neither gives alone

Run one form in the payment or upgrade flow and one in the signup flow. The payment one is where the money is: the respondent has just paid, so the answer joins to revenue with no conversion tracking at all, and the confirmation page was dead space anyway.

The signup one is the only way to see the people a community sends who never pay. Ask only at payment and you can never learn that a subreddit delivers volume that does not convert — which is exactly the judgment that ends a channel.

```
# same channel, two placements, one month
                        signup form   payment form
  reddit                      0.31          0.14     ← sends volume, converts poorly
  hackernews                  0.12          0.19
  slack (Kubernetes)          0.04          0.11     ← smallest list, best rate

# reddit's share among payers / its share among signups = 0.45.
# That ratio IS reddit's signup-to-paid rate relative to the average.
# Nothing computes it for you: it is two rollup calls and a division.
```

Ask early in each flow. Memory decays, but the worse problem is that asking late means asking only the people who stayed, which systematically under-counts any community whose users churn early. A small sample is visibly small; a biased one is not.

## Free text is where you find the community you never listed

There is no _Other_ option — if it is not in the list, people type. That text is stored verbatim and never normalized on the way in, and the most valuable thing attribution ever produces shows up here first: a community you had not thought to list.

```bash
# what people typed instead of picking, most frequent first
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/unresolved?limit=50" \
  -H "Authorization: Bearer hs_sk_..."
# → { "entries": [ { "node_id": "slack_group", "raw_normalized": "the k8s slack",
#                    "occurrences": 9, "variants": ["the k8s slack", "K8s Slack"] } ], … }

# map it — retroactive, so every past window moves with it
curl -X POST https://www.humansurvey.co/api/attribution/forms/abc123efgh45/remaps \
  -H "Authorization: Bearer hs_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"node_id": "slack_group", "raw": "the k8s slack",
       "candidate_id": "slack_k8s"}'
# → 201 { "resolved_responses": 9, "candidate_label": "Kubernetes", "warnings": [] }
```

A mapping is not an edit. Nothing about the stored responses changes — the rollup resolves free text against the live mapping table on every read, so one row fixes three months of history at once and revoking it moves them back. `resolved_responses` tells you exactly how many responses just moved, so "I mapped it and nothing changed" is visible immediately rather than next quarter.

## Getting started

Sign in at https://www.humansurvey.co, copy a key, and hand it to your agent. That is the whole human part.

> "Set up attribution on our upgrade page. Our communities are r/selfhosted, r/devops, r/kubernetes and the Kubernetes and MLOps Slacks — ask which one when someone picks Reddit or Slack. Also list Hacker News, GitHub, X, Google, ChatGPT and word of mouth."

Your agent reads the platform catalog, creates the form, writes the candidate lists and hands back a URL to embed. A month later: _"which communities produced revenue, and which only produced signups?"_

What this is not: a place to ask your members what they thought of the AMA. There is one question here — where did you first hear about us — and no arbitrary questionnaire behind it.

## More

- Docs — form config, the embed contract, cursor reads, the rollup: https://www.humansurvey.co/docs
- Launch attribution — Product Hunt, Hacker News, X, and the spike that lands as Direct: https://www.humansurvey.co/use-cases/product-launch
- Event attribution — conferences and trade shows, and which of the eight it was: https://www.humansurvey.co/use-cases/events
- AI assistant attribution — ChatGPT, Claude, Perplexity and Gemini, which all arrive as Direct: https://www.humansurvey.co/use-cases/ai-assistants
- FAQ — anonymity, what a form can and cannot ask, pricing: https://www.humansurvey.co/faq
