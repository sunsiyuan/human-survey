# Attribution pivot — HDYHAU as the product

**Status:** in progress. Schema landed 2026-07-30 (`apps/web/supabase/migrations/001_init.sql`).

HumanSurvey narrows from "general survey infrastructure for agents" to one question:
**how did you hear about us**, answered at a granularity that is actually actionable.

> **Revision 2 (2026-07-30).** A full-codebase audit against revision 1 found four
> factual errors in it. They are corrected in place below and listed here, because
> each one changed a downstream plan:
>
> 1. §2 claimed `respondent_external_id`, prefill and a per-response webhook survived
>    untouched. **None of the three existed.** The claim traced to `ROADMAP.md`, which
>    describes intent rather than shipped reality. This is not a purely code-deleting
>    pivot; §9's join key in particular is a build, not a reuse.
> 2. §6.1 seeded the rotation from the response id, which is minted server-side inside
>    the POST — i.e. *after* the first render. The seed did not exist when it was
>    needed. Now a client-minted `render_id` (§5.3).
> 3. §5.4 introduced a PATCH without saying what authorizes it, on an endpoint that is
>    public and hands the response id back to the browser. Now a one-time token (§5.4).
> 4. §5.4 made responses mutable while §11 made cursor reads the primary read path,
>    with nothing reconciling them. Now a visibility gate (§5.4).
>
> Decisions settled since revision 1: accounts own data and keys are credentials
> (§10.1); pricing is per-response on a Resend-style volume model (§10.3); the site is
> embed-first (§11); the database was reset rather than migrated (§11.4).

---

## 1. Positioning

> Measure the channels that have no referrer — down to the person and the content.

TikTok in-app, Instagram, podcasts, communities, word of mouth, AI assistants: these are
one class of problem. The exposure happens somewhere our tracking cannot reach. Asking a
human is the only always-on signal that survives every referrer leak.

AI assistants (ChatGPT / Perplexity / Claude) are **one row in that class**, not the
product definition. They are the cheapest row — a catalog entry buys the whole
capability — and the best story to lead with in content, but the bread and butter is
creator channels.

LinkedIn and other channels with their own reporting console are *not* in this class.
They have a different job here: see [§8](#8-calibration-anchors).

### The tension every design decision trades against

**Completion rate is the multiplier; granularity is the substance. They eat each other.**

A single "where did you hear about us" question has the best completion rate and returns
`"TikTok"` — which is not an answer. Six TikTok accounts running three different naming
conventions collapse into one string, and every conclusion drawn from it is noise.
Getting to "which account" requires a second question. So the goal is not *ask less*; it
is **make the second question land only on the people who need it, and not feel like a
second question**.

---

## 2. What changes

### Cut

| Thing | Why it goes |
|---|---|
| Markdown survey syntax + `/api/demo/parse` LLM translation | These are the entry points for *arbitrary* survey expressiveness. HDYHAU does not need them. |
| `scale`, `matrix`, `multi_choice` | HDYHAU is single-select. Multi-select actively destroys attribution — "select all that apply" means "select everything", which means no signal. |
| `showIf` as a general conditional engine | Demoted to one built-in behavior: picking a candidate can expand a follow-up candidate set. |
| The `open/closed/expired/full` lifecycle | An attribution form is a **perpetual stream**, not a bounded study. Collapses to `active/paused`. |
| Generic per-question aggregation | Replaced by an attribution-specific rollup computed at read time. |
| The `::` fill-in encoding | The current free-text mechanism, baked into four published surfaces. Replaced by first-class `raw` (§7). A documented payload changes shape; declare it. |

### Survives

The iframe embed transport: `?embed=1`, the `postMessage` protocol
(`mounting` / `loaded` / `resize` / `submitted` — four events, not three), cursor reads,
API key auth.

**The transport survives; the payload does not.** The `submitted` message body is a
documented public contract and §5.3 replaces it wholesale. That is a breaking change and
belongs in the changelog, not in a "survives untouched" list.

### Must be built, despite reading like it already exists

`ROADMAP.md` marks L1 embed shipped with six capabilities. Three of them were never
built and have zero occurrences anywhere in the codebase:

- `respondent_external_id` — no column, no code, and §9 assumed it as a given
- prefill from URL params — the form never reads `URLSearchParams`
- the per-response webhook — only survey-level terminal events existed

Treat `ROADMAP.md`'s API "locks" as intent, not description. At least one of them was
violated in both directions before this pivot began.

### Net effect

Substantially code-deleting, but not purely. The survey engine, the markdown path and
the lifecycle machinery go; the join key, the per-response webhook, the picker, the
rollup, accounts and billing are net new.

---

## 3. Form shape

Two questions. Progressive disclosure, **not** pagination.

```
Where did you first hear about us?
[ search or type your own                    ]
  ◉ (logo) TikTok          ← selecting expands, in place
  ○ (logo) Facebook
  ○ (logo) Google
  ○ (logo) ChatGPT
  ○ (logo) Reddit
  ○ A friend or colleague
  ○ I don't remember                          ← pinned last

  ┌─ expanded in place, no page transition ──┐
  │ [ search or type your own              ] │
  │ ○ (avatar) Jade   @jade.work0            │
  │ ○ (avatar) Diego  @diego.conversa        │
  │ ○ (avatar) Nico   @nico.translate        │
  │ ○ I don't remember who                   │
  └──────────────────────────────────────────┘
```

### 3.1 Both questions are the same component

The picker does not know what it is asking about. First instance receives platforms,
second receives creators. This generalizes for free: podcast → which show, trade show →
which event, retail → which store.

### 3.2 Label with brand names, not taxonomy, not scenarios

Ranked by how well people answer them:

```
TikTok / Instagram   >   "I saw someone talking about it"   >   "Social media"
```

- **Brand names are the unit of memory.** People store "I saw it on TikTok". A brand
  name has a logo, a color, an app icon — the strongest recall cue available.
- **Zero translation cost.** "Social media" forces a taxonomy lookup. A scenario
  description forces a "does my experience match this phrasing" judgment. A brand name
  forces neither.
- **No ambiguity.** "I saw someone talking about it" could be TikTok, IG, Shorts, or
  Xiaohongshu — you would have to ask the platform anyway, and the follow-up candidates
  are organized by platform.
- **It can carry a logo.** Recognizing an image beats reading a line of text by roughly
  an order of magnitude.

That last point unifies the whole form: **platform logos, then creator avatars —
recognition all the way down, no reading comprehension at any step.**

Rule: **if it has a brand, use the brand name and its logo. Only fall back to
description when there is no brand** — "A friend or colleague", "At a conference or
event". Podcasts are an edge case: they have platforms (Spotify, Apple) but people
remember the *show*, so podcasts route through the follow-up mechanism like creators do.

Because the internal canonical taxonomy and the respondent-facing wording are now the
same vocabulary, **the mapping layer between them is not needed**. One less thing that
can drift.

### 3.3 Longer lists are fine, and short lists are dangerous

**A missing channel does not cost you one data point — it contaminates a different
bucket.** Omit Reddit, and Reddit-sourced users do not vanish; they pick "Google" (they
did search afterwards) or "I don't remember". You lose Reddit *and* book a false entry
against Google.

The most valuable output of attribution is "there was a channel here I never
considered", and a short list guarantees you never find it.

Icons make this affordable: an iconned list is *scanned*, a text list is *read line by
line*. 12–15 entries hold up with logos where 8 would break without them.

### 3.4 Search box is always present; typing is always allowed

One component covers 6 candidates and 200. The empty state shows candidates directly
(people do not spontaneously type); typing filters. Above some count, only the top N
render and search carries the rest.

There is **no "Other" option**. If it is not in the list, type it — one less click, and
one less nudge toward picking something wrong.

Matching runs over `label`, `handle`, and `aliases`. Aliases are supplied by the caller
and never displayed; they exist because people remember descriptions ("the one who does
office stuff"), not handles.

Each result row shows three things — avatar, display name, `@handle` — because any of
the three might be the one they recognize.

### 3.5 "I don't remember" is always visible and never sorted

With a list and a search box in front of them, people who do not remember will pick
*something*. That is worse than having no list at all: it disguises noise as signal.

So `I don't remember` stays pinned last, at the same visual level as the candidates —
never collapsed, never behind a link, never reordered. Same for no-platform fallbacks
like "A friend or colleague".

Candidates therefore split into an **orderable** segment and a **pinned** segment.
Ordering (§6) applies only to the orderable segment.

### 3.6 One question, not two: first touch only

We ask **where you first heard about us**, and do not additionally ask what finally
converted you.

Last touch is near-constant ("searched your brand name") and carries no media-buying
decision. The value of creator channels lives entirely in discovery. The
completion-rate cost of a second framing does not buy back its information.

### 3.7 Two placements: the payment flow and the signup flow

Both, and they answer different questions. A customer typically runs one form in each.

**Payment / upgrade flow.** The respondent is a paying customer, so the response is
joined to revenue with no conversion-event ingest at all. Motivation is highest right
after a commitment, and the confirmation page is dead space anyway — this is why the
ecommerce incumbents are built entirely on the post-purchase moment. This is the
placement the marketing leads with, because "channel × revenue" is the sentence a
budget holder acts on.

**Signup flow.** The only way to see the people a channel sends who *never pay*. Ask
only at payment and you can never learn that TikTok delivers volume that does not
convert — which is exactly the judgment that kills a bad channel.

**Together they give a number neither gives alone.** Divide a channel's share of the
paying population by its share of the signup population and you get how that channel's
conversion compares to your overall rate — above 1 it converts better than your average,
below 1 worse. Multiply that ratio by your overall signup-to-paid rate to get the channel's
own rate. No incumbent produces this, because no incumbent asks twice.

> An earlier revision of this section said the ratio *is* the channel's conversion rate. It
> is not: the ratio is `conversion(channel) / conversion(overall)`, so it is an index rather
> than a rate, and the missing factor is the overall rate. The wrong version reached the FAQ,
> llms.txt and llms-full.txt before it was caught. Recorded rather than quietly corrected,
> because a product whose whole argument is that most attribution numbers are confidently
> wrong cannot afford to publish one and then pretend it never did.

Two consequences worth stating:

- **Ask early within each flow.** Memory decays, and — worse — asking later means
  asking only the people who stayed. If a channel's users churn early, late questioning
  systematically under-counts it. Bias is more damaging than a smaller sample, because
  a small sample is visibly small and a biased one is not.
- **Payment-only placement does not sustain per-response pricing** (§10.3). A customer
  with 500 paying customers a month generates 500 responses and lives in the free tier
  forever. The dual placement is honest product advice that also happens to be what
  makes the volume model work.

### 3.8 Skipping is allowed

Making it required converts "I don't remember" respondents into random pickers. That
does not raise the completion rate; it lowers data quality while appearing to raise it.

### 3.9 Theme tokens, not a theme editor

Embedded in someone else's payment flow, a form that looks foreign costs completion rate
directly. `configure` accepts a small fixed set: accent color, radius, font family, dark
mode.

This does **not** reopen "visual theme editor / brand-customization GUI". The line: **a
bounded set of parameters is a requirement of the embed form factor; a GUI for authoring
them is not.** `ROADMAP.md` and the published FAQ answer ("Not today") must be amended
in the same change, or this reads as a broken promise.

Note the real cost: the survey components hard-code palette utilities throughout with no
dark variants, and the layout injects webfonts and site-wide structured data into every
embedded iframe. This is a styling pass over the whole component tree, not a variable
swap.

---

## 4. Catalog vs. candidates

**The product does not resolve identities.** It renders a candidate set and returns the
id that was chosen. Who produced that set, and on what basis, is the caller's business.

| | Owner | Contents | Lifetime |
|---|---|---|---|
| **Catalog** | product | Platforms + official logos + aliases (TikTok, Instagram, YouTube, LinkedIn, Reddit, X, Google, ChatGPT, Perplexity, Spotify, …) | Stable; a finite well-known set |
| **Candidates** | caller | Creator handles, avatars, podcast shows, events, stores | Changes monthly |

Platform logos belong to the product because platforms are a finite, stable set worth
maintaining centrally. Creator avatars must come from the caller — matching a vague
description against a creator database is upstream work, not ours.

The catalog lives as a checked-in module with SVGs served from the app — roughly thirty
rows that want review and rollback, at zero read-path cost.

**Label and icon are copied into the config snapshot at configure time**, keeping the
catalog slug only for provenance. Joining a live catalog at read time would mean a
product-side logo swap silently rewriting what an old rollup claims was rendered.

This is also what keeps the product sellable to anyone other than its first customer:
the abstraction is **attribution candidate**, not *creator*. Creators are just what the
first customer happens to have.

---

## 5. Contracts

### 5.1 Candidate

```ts
type Candidate = {
  id: string            // caller-defined stable key
  label: string         // displayed — "Jade", "TikTok"
  handle?: string       // displayed — "@jade.work0"
  icon_url?: string     // logo or avatar
  aliases?: string[]    // matched, never displayed
  pinned?: 'end'        // excluded from ordering; always last
  expands?: string      // id of the AskNode to reveal on selection
  catalog_slug?: string // provenance when sourced from the platform catalog
}
```

**`id` must be a stable key that survives renames.** Handles change. Using a handle as
the id splits a creator's history in half on the day they rename. (For TikTok Shop
creators the rename-proof key is `oecuid`; for platforms, our catalog slug.)

Because ids are caller-defined, the product's job flips from *assigning* ids to
*validating* them — a duty with no analogue in the pre-pivot normalizer, which minted
positional ids that renumbered on every edit. The validator must enforce: id uniqueness
within a node, `expands` resolving to a real node, exactly one root, no expansion
cycles, at most one `pinned` per node. It must validate **before** it builds, or the
structured-error path is unreachable for the most common malformed input.

### 5.2 AskNode

```ts
type AskNode = {
  id: string
  prompt: string
  candidates: Candidate[]
  allow_free_text: boolean          // default true
  order: 'fixed' | 'rotate'         // default 'rotate' — see §6
}
```

### 5.3 Response

One request per node. The follow-up arrives as a PATCH (§5.4), not as a second field.

```ts
// POST /api/attribution/forms/{id}/responses
{
  render_id: 'V1StGXR8_Z5j',   // client-minted, before first paint
  node_id: 'channel',
  answer: { candidate_id: 'tiktok' } | { raw: '…' } | { dont_remember: true } | { skipped: true },
  selected_via_search: false,
  config_version: 7,
  external_id: 'usr_8812',     // the host's own user id — see §9
  host_origin: 'https://app.example.com',
  metadata: { … }
}
// → { response_id, patch_token, next_node? }
```

**`render_id` is minted by the client**, before first paint. It is the seed for the
`rotate` permutation, which cannot be the response id — that is minted server-side
inside the POST, after the first render has already happened.

**The client sends no position data at all.** The server derives the entire impressions
map *and* the selected index from `(render_id, config_version, node)`, which it already
has, by calling the same pure permutation the client rendered with.

That is a deliberate reversal of an earlier design in which the client sent a map and
the server verified it. Two sources of truth for "where was this rendered" produced four
distinct defects in one review round: the two disagreed about pinned rows so the
verification rejected *every* genuine submission; the impressions denominator was
verified while the selections numerator was still taken verbatim from the body and so
remained forgeable; and two separate expressions quietly reintroduced positions the
search-filter rule had just excluded. They were one bug wearing four hats. **The fix was
not to align the two sources but to delete one.**

What that buys: the numerator is underivable from the request body, so it cannot be
forged; nothing can disagree, so no honest submission can be rejected; and the pinned
rule is decided in exactly one function. What it gives up: if the client's real render
ever diverged from the recomputation, we would not detect it — acceptable, because the
previous design "detected" it by discarding the response and the respondent's time.

**`selected_via_search` stays client-supplied**, because the server sees the list but
not the keystrokes. It is only ever used to *suppress* a position, never to invent one —
a respondent who types "jad" and picks the only match at index 0 would otherwise book a
position-0 impression that has nothing to do with the effect being modelled. A client
that lies about the flag withholds its own data point and moves nothing else.

Pinned candidates are excluded from the impressions map entirely, matching §6.2's rule
that they are excluded from rotation and from the model. Below-the-fold options *are*
counted; treating "rendered" as "seen" is a known approximation, which is why the
estimated weights ship with their sample size (§6.2).

### 5.4 Progressive submission

**POST on the first selection; PATCH when the follow-up completes.**

This buys the benefit of pagination (the first answer is already durable) without paying
its cost (no page transition, no "how many more screens" anxiety).

Two mechanisms make it safe:

**A one-time capability token.** POST returns a `patch_token` alongside the response id.
PATCH requires it. Without this, a public PATCH keyed on an id that the endpoint hands
straight back to the browser lets anyone holding an id overwrite someone else's answer.

**A visibility gate.** A response becomes visible to cursor reads only once it is
complete, or once an abandonment sweep has closed it. The cursor token is stamped at
that moment, not at insert. Every row is therefore emitted exactly once and is final
when emitted, so no consumer has to upsert.

Without the gate, `seq` is an insert-order token on what used to be an insert-only
table: an agent whose cursor had already passed a row would receive the channel answer
and **never the creator answer** — precisely the half of the data this product exists to
collect.

The gate also makes the abandonment read-out well-defined by construction: the share of
responses that picked a channel and never completed the follow-up **is the candidate
coverage metric**. It ships in the rollup and needs no separate instrumentation.

### 5.5 Config versions are immutable snapshots

`config_version` is not a counter on the form. It is the primary key of a stored,
never-updated snapshot of the node and candidate set.

This is forced by §10: reconfiguring is a monthly habit. If only the current config
existed, dropping or renaming a creator would silently rewrite what last quarter's
rollup claimed was shown, and §6.2 would lose the definition of the option set it was
fit over. **Snapshots cannot be backfilled** — the information never existed.

Identical reconfigures are deduplicated by a content hash and return the existing
version. This is not tidiness: §6.2 scopes its sample to one config version and returns
null below a minimum floor, so an agent re-posting an unchanged config every month would
fragment the sample and switch the correction off — silently, with no error. The
canonicalization rule must stay stable across releases or the dedupe quietly stops
matching.

---

## 6. Ordering and the position effect

Order affects results. Options shown earlier are selected at systematically higher rates.
This is a known survey-methodology effect, not a hypothesis.

This creates a specific trap for the obvious feature request — *sort options by media
spend*:

> Put the biggest-budget channel first → its self-reported share inflates → the data
> confirms the budget was well allocated.

A self-reinforcing bias is the last thing an attribution tool can afford.

### 6.1 Two modes

- **`rotate` (default)** — the orderable segment is permuted per respondent, seeded by
  `render_id` so a reload is stable. Every option spends equal expected time at every
  position, so **the raw share is unbiased by construction** — no correction needed.
- **`fixed`** — the caller's array order is used verbatim. This is where budget-ordering
  lands: sort the array by spend, pass `fixed`, accept the bias. The rollup reports its
  magnitude (§6.2) rather than silently absorbing it.

The default is `rotate` because defaults should serve data quality. `fixed` exists
because consistent screenshots and support scripts are real needs.

### 6.2 Estimating the position weight

Under `rotate` the weights are not needed for correctness, but they are still worth
computing: they quantify the effect for `fixed`-mode clients and let historical `fixed`
data be corrected.

For option *j* rendered at position *p*, let `n[j][p]` be impressions and `s[j][p]`
selections (both scoped to one config version and one node). Fit the multiplicative
model `rate[j][p] ≈ θ[j] · w[p]` by iterative proportional fitting:

```
w[p]  ∝  Σ_j s[j][p]  /  Σ_j n[j][p]
θ[j]  ∝  Σ_p s[j][p]  /  Σ_p (n[j][p] · w[p])
```

Iterate to convergence (a handful of passes), normalize `Σ θ = 1`. Corrected share of
option *j* is `θ[j]`.

Guards, because this is the one place in the product where it is easy to output
confident nonsense:

- Report `share_corrected` **only** above a minimum impressions-per-position floor;
  below it, return `null` and the raw share, not a smoothed guess.
- Return `w` and its sample size in the payload. If the caller cannot see how big the
  effect was, they cannot judge whether to trust the correction.
- Pinned options are excluded from both rotation and the model.

---

## 7. Rollup, raw, and retroactive remapping

Two answer forms come back: `candidate_id` (resolved) and `raw` (free text). Because ids
are caller-defined, **normalization never happens at write time** — there is no way to
end up with a `TikTok` bucket and a `tiktok` bucket.

`raw` is stored verbatim and is **retroactively remappable**. The remap table is scoped
to a form, uniquely constrained on live rows, and revocable rather than deletable:

```
attribution_remaps(form_id, node_id, raw_normalized, candidate_id, revoked_at)
  UNIQUE (form_id, node_id, raw_normalized) WHERE revoked_at IS NULL
```

Form scoping is not optional. Node ids and candidate ids are both caller-defined, so
every caller will have a node named `channel`; without the scope one customer's remap
would resolve another's free text. The uniqueness matters for a different reason: two
live remaps of the same string double-count in a read-time join.

The target is deliberately **not** a foreign key to a candidate — the candidate may have
been dropped from the current config while history still needs the mapping.

The rollup computes from raw response rows against the *current* remap table. So when an
agent notices that 12 of last month's 30 free-text answers were all the same
newly-signed creator, one mapping fixes two months of history at once.

**Hard requirement this imposes:** never pre-aggregate at write time, never discard
`raw`. And aggregate **in SQL with the from/to window** — "compute at read time" in
application code over a perpetual stream is a scaling commitment, not a design choice.

### Rollup shape

```
GET /api/attribution/rollup?form_id=…&by=channel|candidate&metric=responses|revenue&from=&to=
```

```jsonc
{
  "rows": [
    { "node_id": "channel", "candidate_id": "tiktok", "label": "TikTok",
      "responses": 412, "share": 0.31, "share_corrected": 0.28,
      "revenue_cents": 1840000 }
  ],
  "unresolved": { "raw": 63, "dont_remember": 128, "skipped": 91 },
  "followup_abandoned": { "channel:tiktok": 0.22 },   // candidate coverage read-out
  "position_effect": { "w": [1.18, 1.06, 0.99, …], "n": 4210 },
  "calibration": { "linkedin": { "recall": 0.62, "n": 88 } }
}
```

`form_id` is required, on this and on every tool in §10. One-form-per-key was never an
intended constraint, and a union across forms would mix candidate populations into one
`share` denominator — the confident-nonsense failure §6.2 spends its guards preventing.

Every number that can be wrong ships next to the thing that says how wrong it might be.
**The product's job is not to output a confident percentage — most attribution tools do
that, and it is why nobody believes them.**

---

## 8. Calibration anchors

Channels with their own reporting console have ground truth. That makes them useful as a
*measuring stick for the survey itself*:

```
recall[c] = (self-reports naming channel c) / (conversions channel c's own console reports)
```

With that coefficient you know how much self-reporting under-reports overall, and can
correct the channels that have no ground truth.

This is what moves self-reported attribution from "directional" to "a number you can
plan against", and it is the answer to the first objection every buyer raises — *people
just make things up*. The answer is not "there's bias but the trend is useful"; it is
**"we computed your bias coefficient from your own LinkedIn console"**.

B2B is structurally suited to this: every paid channel has its own back office.
Ecommerce-native competitors cannot do it as cleanly.

Anchor counts are **period aggregates** and need their own table keyed by
`(form_id, candidate_id, period_start, period_end)`. Revision 1 said to post them
"alongside the conversion events", which does not typecheck against §9's strictly
per-respondent shape.

---

## 9. `external_id` — the join key, in both directions

Every response carries an `external_id`: whatever identifier the host already uses for
that person. It is captured from the first POST, indexed per form, and deliberately
**not unique** — a retake is allowed, and the rollup counts the first response per
`(form_id, external_id)`. Adding a uniqueness constraint later is easy; dropping one
that turned out to be wrong is not.

It was captured from day one even though the events endpoint lands later. Revision 1
deferred this on the premise that the embed already carried it. It did not, and a join
key is not backfillable — deferring would have meant discarding it for months.

**Inbound: revenue joins to channel.** The host pushes conversion events keyed on the
same id, and aggregate attribution becomes channel × revenue instead of channel × heads.

```
POST /api/attribution/events
{ form_id, external_id, event: 'signup'|'activated'|'paid'|'churned',
  value_cents?, currency?, occurred_at, idempotency_key? }
```

Caller-pushed on purpose, not a Stripe or AppsFlyer integration. Direct integrations are
what make a tool hard to remove, but they are an unbounded maintenance surface. Ship the
pushed event; shape the schema the way a direct integration would want it, so adding one
later is additive.

**Outbound: user-level attribution.** The same id lets a customer join our answers back
into their own user table, one row at a time — *this specific user came from this
specific creator*. That is a different product from the rollup, and for advanced users it
is the more valuable one: it makes attribution a property of a user record rather than a
monthly report, so cohort analysis, sales context and lifecycle messaging can all read
it.

So the read surface must include a per-response lookup, not only aggregates:

```
GET /api/attribution/responses?form_id=…&external_id=…
```

The per-response webhook covers the same need in push form, delivering each answer to
the host's CRM as it completes. Between the two, a customer never has to poll to keep
their user table current.

Aggregates remain the default framing — most buyers want the monthly picture, and
user-level joining assumes an engineering-capable customer. But the column and the
endpoint cost almost nothing, and without them the ceiling on what a sophisticated
customer can do is set by us rather than by them.

---

## 10. Accounts, keys, and the business model

### 10.1 Accounts own data; keys are credentials

The pre-pivot model had no owner layer: the API key *was* the identity. Losing a key
meant losing the data with no recovery path, and rotating one meant losing access to
everything the old key had created.

That was survivable when a survey was a two-week artifact. It is not survivable for
attribution, where the form is embedded in a payment flow for months, the candidate list
is maintained monthly, and the agent session that reads the rollup is never the session
that created the key.

Two layers, not three: `account → keys`. No project layer. An agency running three
clients holds three accounts and three keys — which is the better arrangement anyway,
because **the customer owns their attribution history and the agency holds a key**. When
the relationship ends, nobody has to argue about whose data it is.

Sign-in is an email magic link. Not GitHub: after the pivot the buyer is a growth owner,
not a developer.

The account area covers **accounts, keys and billing only.** Configuration and results
stay API/MCP. This line has to be drawn now, before a login page attracts a candidate
editor and a results table and becomes the dashboard the product does not want.

### 10.2 Keys must land on disk, not in a transcript

The root cause of "the agent lost the key" is not the absence of accounts — it is that
the self-serve path returned a key into a conversation, and conversations end.

So the MCP server gets a device-code flow: the agent starts it and prints a short code,
the human approves once in a browser, the server polls, receives the key, and writes it
to its local config. Accounts then cover the second-order case where the local file is
gone too.

Anonymous key creation goes away. Its usefulness was a frictionless first run, but the
real bottleneck was never signup — it is time-to-first-successful-call, and the device
flow keeps that at seconds while ensuring every key has an owner from birth.

### 10.3 Pricing: Resend-shaped

**The billable unit is responses collected.** The pivot makes this the only sane choice:
an account has one perpetual form per placement, so per-survey pricing stops meaning
anything.

Count a response that answered the first question and abandoned the follow-up. It is
real data — the channel is known — and the abandonment rate is a metric the product
already reports. Write this rule down before the first invoice, or it becomes a support
ticket.

Volume tiers, not feature tiers. A generous free tier is the distribution mechanism, not
a concession — the same reason Resend's free tier is large enough to build on. This
supersedes the plan to gate a headless SDK behind a paid tier: feature gating forces the
customer to make an upgrade decision, volume gating upgrades them automatically as they
grow.

Marginal cost per response is near zero, so the ceiling is set by value, not cost. A
customer spending a quarter of their marketing budget on a channel they cannot measure
is not deciding between twenty and forty dollars. Start simple anyway.

**One consequence: origin allowlisting ships in v1.** It was previously deferred until
abuse was observed. Under per-response pricing it stops being an abuse question — an
unlisted origin embedding your form spends your quota — and becomes billing integrity.

### 10.4 Live configuration, and what agent-first means now

Configuration is a **living parameter maintained on a monthly cadence**:

- **Order** tracks media spend.
- **Candidates** track creator partnerships — three new ambassadors this month, three
  new rows.
- **Which channels expand** — only spend-heavy channels earn the follow-up question;
  small ones skip it and save a step of friction.

The third is the highest-value one and only an agent does it well: it knows where the
money is this month, so it knows where to spend the respondent's one extra click.

So the MCP surface is a **read-write loop on a monthly cycle**, not "configure once,
poll forever":

| Tool | Direction |
|---|---|
| `login` | bootstrap — device-code flow, writes the key to local config |
| `list_forms` | read — an agent cannot configure a form whose id it cannot find |
| `get_attribution` | read — rollup, corrected shares, coverage |
| `compare_windows` | read — month over month by candidate |
| `list_unresolved` | read — free text awaiting remap |
| `remap` | write — resolve free text to a candidate, retroactively |
| `configure` | write — order, candidates, expansion policy |

> This table is the design-time sketch, not the shipped surface, and is left as written for
> the same reason the changelog is: it records what was intended on the day. Two of these
> names never shipped — `compare_windows` was not built, and `configure` shipped as
> `configure_form` — and one that did ship is missing, `revoke_remap`. The list that is true
> today is in `packages/mcp-server/README.md` and on /docs; read those, not this.

This is the concrete form of agent-first here. Not "an agent *can* call the API" — **the
configuration is not maintainable without one.**

---

## 11. Decisions taken

1. **Site is embed-first.** The H1 is the §1 positioning line; the primary CTA points at
   the payment flow, with the signup flow named as the second placement (§3.7). MCP
   install is a named second beat — "the embed collects it, the agent keeps the
   candidate list current" — so directory listings stay honest while the headline talks
   to the buyer. The audience contradiction in the current copy (built for people who
   install MCP servers, and explicitly listing marketing-funnel lead capture as an
   anti-fit) is the thing the pivot exists to fix.
2. **The rollup is not a dashboard.** `ROADMAP.md` lists conversion-funnel analytics and
   a results dashboard as permanently out of scope. Reconciliation: **no human-facing
   dashboard — the agent is the dashboard**, aggregates ship as an API/MCP resource.
   That is consistent with AI-first I/O and is the differentiator against dashboard-first
   incumbents. The ROADMAP wording must say this explicitly or the line gets cited
   against the rollup later.
3. **API surface is new, not versioned in place.** `/api/attribution/*` with `form_id`.
   The respondent URL stays `/s/{id}`. There is no back-compat obligation: the export
   taken before the reset showed thirteen keys, of which every one was a smoke test or
   the owner's own demo, and no third-party user at all.
4. **The database was reset, not migrated.** Old rows were structurally unconvertible in
   any case — product-minted positional ids where the new schema needs caller-defined
   stable ones, and no recorded render order to reconstruct `positions` from.
5. **Migrations now run through a runner with a ledger.** Previously they were applied by
   hand and "what has production actually run" was reconstructed from prose in another
   repo. For a pivot that rebuilds the schema, that was the riskiest operational fact
   about the project, and a reset is the one moment when fixing it costs nothing.

## 12. Deliberately not doing

- Entity extraction / fuzzy matching of free text against a creator database — caller's
  job (§4). Free text is the fallback once avatar recognition is the primary path.
- LLM normalization of free text in v1. Hand `raw` to the caller's agent, which is
  already reading results.
- Last-touch questioning (§3.6).
- Direct Stripe / AppsFlyer integrations (§9).
- Any human-facing analytics dashboard (§11.2).
- A project layer between accounts and keys (§10.1).

## 13. Unresolved

**Should "I don't remember" get a second chance** — e.g. following it with "roughly
which app was it in?" It could recover some sample, but it can also push genuine
non-rememberers into guessing. Leaning no. Cheap to A/B once the form ships.

**What the abandonment threshold is.** The visibility gate (§5.4) needs a duration after
which an incomplete response is swept and released to cursor reads. Too short and
slow respondents are recorded as abandoners; too long and the agent's first answer is
delayed for no reason. Pick it from real data in the first weeks, not now.
