# The only way to know ChatGPT sent them is to ask

_Use case · AI assistants_

Canonical: https://www.humansurvey.co/use-cases/ai-assistants

ChatGPT, Claude, Perplexity and Gemini do not send a referrer. The people they send you arrive as `direct / none`, in the same bucket as someone typing your domain from memory. **No log-based method fixes this, and the size of what you are missing is exactly the thing you cannot see.** One row in a candidate list is what makes it visible.

---

## Why it lands in Direct

- The answer is rendered in a native app or a desktop client, which is not a web page and has no referrer to pass on.
- **Most often, there is no click at all.** The person reads a name in an answer, searches it, and lands on you from Google. The visit genuinely came from search; the _discovery_ happened somewhere with no log.

A perfect referrer header would still book this person against Google, because Google is where they clicked. Only the person knows the assistant was the reason.

## The wording is most of the work

> "AI assistant" is a category. "ChatGPT" is a memory.

- **Use the product name, never the category.** A category asks them to classify their own experience first, which is exactly the step that ends in _I don't remember_.
- **Put it beside Google, not under it.** The catalog's default channel list ships `chatgpt` as its own row, next to `google`.
- **One row per assistant, not one row for all of them.** Collapse them into one and you can never answer "is this ChatGPT or is this all four".
- Order rotates per respondent by default, so no assistant sits above Google for everybody and the raw share is unbiased by construction. If you pin the order with `"order": "fixed"`, you inherit the position bias that comes with it.

## Where the question goes

Lead with the **payment or upgrade flow**. The respondent has just paid, so the answer is joined to revenue with no conversion tracking at all: "ChatGPT produced this much revenue last month" is the sentence a budget holder acts on.

Then run a second form in the **signup flow**. It is the only way to see the people an assistant sends who never pay — and with both running, you can divide a channel's share of the paying population by its share of the signup population. Above 1 it converts better than your average, below 1 worse.

Ask early inside each flow. Memory decays, and asking late means asking only the people who stayed. A small sample is visibly small. A biased one is not.

## The follow-up: what they were asking

Picking a candidate can expand a follow-up in place, no page transition. Point the assistant rows at a node that asks what they were asking about, and what comes back is **a real question from a real person who then converted** — a different artifact from the prompt sets an AI-visibility tool guesses at and scores you against.

The assistant catalog entries carry no follow-up by default, and the topic list is yours. This is you spending one extra tap on the channel you care about most this month:

```json
{
  "nodes": [
    {
      "id": "channel",
      "prompt": "Where did you first hear about us?",
      "order": "rotate",
      "allow_free_text": true,
      "candidates": [
        { "id": "google",     "catalog_slug": "google" },
        { "id": "chatgpt",    "catalog_slug": "chatgpt",    "expands": "ai_topic" },
        { "id": "perplexity", "catalog_slug": "perplexity", "expands": "ai_topic" },
        { "id": "claude",     "catalog_slug": "claude",     "expands": "ai_topic" },
        { "id": "gemini",     "catalog_slug": "gemini",     "expands": "ai_topic" },
        { "id": "reddit",     "catalog_slug": "reddit" },
        { "id": "friend",     "catalog_slug": "friend" },
        { "id": "dunno", "label": "I don't remember",
          "pinned": "end", "dont_remember": true }
      ]
    },
    {
      "id": "ai_topic",
      "prompt": "What were you asking about?",
      "allow_free_text": true,
      "candidates": [
        { "id": "topic_alternatives", "label": "Alternatives to a tool I already use" },
        { "id": "topic_howto",        "label": "How to do a specific thing" },
        { "id": "topic_pricing",      "label": "Comparing prices" },
        { "id": "topic_dunno", "label": "I don't remember",
          "pinned": "end", "dont_remember": true }
      ]
    }
  ]
}
```

- `allow_free_text` is where the value actually is. Your three topic buckets are a guess; what someone types is the phrasing. It is stored verbatim, capped at 500 characters, and never truncated silently.
- All four assistants expanding into one `ai_topic` node pools the topic counts across them. Give each its own node if you need topics per assistant — pooling is a decision you make in the config, not one you can undo at read time.
- A follow-up costs a tap, so it belongs on the channels carrying spend. The respondent who answers the first question and walks away has still told you the channel, and that response counts.

## What comes back

There is no dashboard. Your agent reads the aggregate over HTTP and writes the note:

```bash
curl "https://www.humansurvey.co/api/attribution/rollup\
?form_id=abc123efgh45&by=candidate&metric=revenue&from=2026-07-01&to=2026-08-01" \
  -H "Authorization: Bearer hs_sk_..."
```

```jsonc
// ILLUSTRATIVE — invented figures, one month of a payment-flow placement
"denominator": { "completed_responses": 1204, "per_node": { "channel": 1204, "ai_topic": 118 } },
"rows": [
  { "node_id": "channel", "candidate_id": "google",     "responses": 388, "share": 0.32, "revenue_cents": 1610000 },
  { "node_id": "channel", "candidate_id": "chatgpt",    "responses":  96, "share": 0.08, "revenue_cents":  486000 },
  { "node_id": "channel", "candidate_id": "perplexity", "responses":  21, "share": 0.02, "revenue_cents":   92000 },
  { "node_id": "channel", "candidate_id": "claude",     "responses":  14, "share": 0.01, "revenue_cents":   71000 },
  { "node_id": "channel", "candidate_id": "gemini",     "responses":   9, "share": 0.01, "revenue_cents":   38000 },
  { "node_id": "ai_topic", "candidate_id": "topic_alternatives", "responses": 51, "share": 0.43, "revenue_cents": null }
],
"unresolved": { "raw": 61, "dont_remember": 143, "skipped": 88, "per_node": { … } }
```

The **denominator ships next to the shares**, so 8% is 96 of 1,204 and not a percentage of some population you have to infer. And the people who did not give you an answer stay visible in `unresolved` instead of being dropped from the base — dropping them would inflate every channel on the page, ChatGPT included.

Free text arrives unresolved on purpose. Once a month, read what piled up and map the recurring phrasings onto a topic — retroactively, across every window that already went out:

```bash
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/unresolved?node_id=ai_topic" \
  -H "Authorization: Bearer hs_sk_..."
# → the phrasings people typed, grouped and counted, most frequent first:
#   "best invoicing tool for freelancers"        7
#   "alternative to <competitor>"                5
#   "how to send a quote that gets signed"       4
```

Nothing about the stored response changes; the rollup resolves against the live remap table on every read.

## What this does not tell you

The product's job is not to hand you a confident percentage:

- **It is self-report, and self-report is imperfect.** People misremember, and some of them will have met your name twice. The base is always there, and _I don't remember_ is a first-class row rather than a rounding error.
- It measures _where they first heard_, not what closed them. Last touch is near-constant — people search your brand name — and carries no budget decision.
- "ChatGPT" is not proof the assistant recommended you. It could have cited an article about you, and the respondent cannot tell the difference. Read the row as _this person's discovery ran through ChatGPT_.
- `share_corrected`, `position_effect` and `calibration` come back as explicit nulls today, not as computed numbers. Rotation already makes the raw share unbiased, and an absent number is better than a smoothed guess.
- Small channels are small samples. Nine Gemini responses is nine responses, and the payload gives you the count so you can decline to draw a conclusion from it.

## Getting started

Sign in, copy a key, hand it to your agent. From there it reads the catalog, creates one form per placement, writes the candidate lists, and gives you a URL to embed early in checkout and in signup. A month later you ask it how the month went.

## More

- Docs — endpoints, embed contract, full rollup shape: https://www.humansurvey.co/docs
- Agent-readable overview: https://www.humansurvey.co/llms.txt
- Full machine reference: https://www.humansurvey.co/llms-full.txt
- Communities and word of mouth: https://www.humansurvey.co/use-cases/community-feedback
- Launch day: https://www.humansurvey.co/use-cases/product-launch
- Podcasts and events: https://www.humansurvey.co/use-cases/events
