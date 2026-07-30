import type { Metadata } from 'next'
import Link from 'next/link'

import {
  CodeBlock,
  Quote,
  Section,
  Unordered,
} from '@/components/use-cases/primitives'

export const metadata: Metadata = {
  title: 'Launch attribution — HumanSurvey use case',
  description:
    'A launch spike lands in analytics as Direct, because most of it arrives from apps, DMs and group chats that send no referrer. Ask the person which of the places you posted it was — and which account on X — inside your own signup and payment flow.',
  alternates: {
    canonical: '/use-cases/product-launch',
    types: { 'text/markdown': '/use-cases/product-launch.md' },
  },
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Launch attribution: which of the six places you posted actually worked',
  description:
    'Configuring a how-did-you-hear-about-us question for a launch, so Product Hunt, Hacker News and X separate, and X resolves to the specific account whose post was seen.',
  datePublished: '2026-04-20',
  dateModified: '2026-07-30',
  author: { '@type': 'Organization', name: 'HumanSurvey' },
  publisher: { '@type': 'Organization', name: 'HumanSurvey' },
  mainEntityOfPage: 'https://www.humansurvey.co/use-cases/product-launch',
}

// Verified against the shipping API on 2026-07-30 as the body of
// PUT /api/attribution/forms/{id}. Two candidates expand, seven do not — that split is
// the expansion policy, and it is the thing worth re-deciding after the launch.
const configSnippet = `{
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
}`

const cursorSnippet = `curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/responses\\
?since_seq=8412&limit=100" \\
  -H "Authorization: Bearer hs_sk_..."`

const cursorShapeSnippet = `{
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
}`

const windowsSnippet = `# launch week
GET /api/attribution/rollup?form_id=…&from=2026-05-12&to=2026-05-19
  producthunt   0.28    x   0.20    hackernews   0.16    google   0.05

# the month after it
GET /api/attribution/rollup?form_id=…&from=2026-05-19&to=2026-06-19
  producthunt   0.09    x   0.11    hackernews   0.21    google   0.18

# Product Hunt was the day. Hacker News and search were the month.
# Close the window on launch day and you conclude the opposite.`

const rollupShapeSnippet = `{
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
}`

export default function ProductLaunchPage() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)] hover:text-slate-900"
          >
            ← HumanSurvey
          </Link>
          <div className="flex gap-2">
            <Link
              href="/use-cases"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Use cases
            </Link>
            <Link
              href="/faq"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              FAQ
            </Link>
            <Link
              href="/docs"
              className="hidden min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 sm:inline-flex"
            >
              Docs
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Use case · Launch day
          </p>
          <h1 className="text-4xl tracking-[-0.02em] text-slate-950 sm:text-5xl">
            You posted in six places. The spike came back labelled Direct.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            A launch is the one traffic event you most want to decompose, and the one your
            analytics is least able to. The posts you wrote do send referrers. The traffic that
            converts mostly does not: it arrives after the post was screenshotted into a group
            chat, quoted by someone with an audience, read in a mail client, or opened in an
            app.{' '}
            <strong className="font-semibold text-slate-900">
              The only signal that survives all of that is asking, and the only version worth
              asking gets down to which account&apos;s post it was.
            </strong>
          </p>
        </section>

        <Section tag="Why launch traffic is the worst-attributed traffic you will ever get">
          <p>
            Every mechanism that makes a launch work also strips the evidence that it worked.
            The reshare is the point — you posted once, and the useful volume came from other
            people repeating you, in places you cannot instrument. Concretely:
          </p>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">The apps send nothing.</strong>{' '}
                An in-app browser on X, LinkedIn or Reddit, and every DM and group chat the link
                passed through, arrive with no referrer at all.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  A UTM link only covers the link you placed.
                </strong>{' '}
                It cannot follow the copy-paste, which on launch day is most of the distribution.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  The referrers that do arrive name a domain.
                </strong>{' '}
                <code>x.com</code> tells you a launch is happening on X. It cannot tell you that
                one quote-post did four times the work of your own announcement.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Last-click buries the whole thing.
                </strong>{' '}
                Somebody sees the post on Tuesday and searches your name on Thursday. Analytics
                credits search. You conclude that SEO launched your product.
              </>,
            ]}
          />
          <p>
            So the post-launch question — <em>which of the six places we posted actually
            worked</em> — is not a hard analytics query. It is unanswerable from analytics, and it
            is the only question that changes what you do for the next launch.
          </p>
        </Section>

        <Section tag="The configuration">
          <p>
            One form in the signup flow, which is where launch traffic actually lands, and one in
            the payment flow, which is what settles the argument a month later. Both take the
            same config.
          </p>
          <CodeBlock>{configSnippet}</CodeBlock>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  X expands, Product Hunt does not.
                </strong>{' '}
                A launch on X is six accounts amplifying each other; a launch on Product Hunt is
                one page. Spend the respondent&apos;s one extra click where the answers differ.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Ids survive renames; handles do not.
                </strong>{' '}
                <code>x_1799210044</code> is the numeric account id, so the day{' '}
                <code>@rennacodes</code> becomes something else, that account&apos;s history stays
                in one piece. <code>handle</code> and <code>icon_url</code> are what the
                respondent sees, and they are the fields you expect to edit.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Aliases catch the people who remember a description.
                </strong>{' '}
                &ldquo;the person who does the teardown threads&rdquo; is matched by the search
                box and never displayed, because that is genuinely how the memory is stored.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Nothing here can be closed or capped.
                </strong>{' '}
                There is no expiry and no response limit — the form sits in the flow after the
                launch is over, which is the only way to see the tail. Status is{' '}
                <code>active</code> or <code>paused</code>, and pausing is reversible.
              </>,
            ]}
          />
        </Section>

        <Section tag="Launch day: read the rows, not the aggregate">
          <p>
            Aggregates are the wrong shape while a launch is still happening. Pass the previous
            cursor back and you get only what has completed since — every row emitted exactly
            once and final when emitted.
          </p>
          <CodeBlock>{cursorSnippet}</CodeBlock>
          <CodeBlock>{cursorShapeSnippet}</CodeBlock>
          <p>
            That second row is the reason this read exists.{' '}
            <strong className="font-semibold text-slate-900">
              Somebody typed a Slack group you had not listed
            </strong>{' '}
            — a channel that would otherwise have arrived as Direct forever, found on the one day
            you were watching. Free text is stored verbatim and stays mappable, so once you know
            the group exists you can resolve every past answer that named it and add it to the
            list for tomorrow.
          </p>
          <p>
            <code>next_check_hint_seconds</code> paces the polling for you:{' '}
            <code>0</code> while a page is waiting, <code>120</code> while somebody is mid-answer,{' '}
            <code>3600</code> once it has gone quiet. Nothing in this API ever reports that
            collection has finished, because a form in a signup flow never does.
          </p>
        </Section>

        <Section tag="A week later: the tail is the finding">
          <p>
            The single most common mistake in launch attribution is measuring the launch over the
            window of the launch. Responses are windowed on when they completed, so you can ask
            the same question of two windows and watch the answer invert.
          </p>
          <CodeBlock>{windowsSnippet}</CodeBlock>
          <p>
            Product Hunt is a day-shaped channel and Hacker News is a month-shaped one. Both
            numbers are real; only the pair is useful. Then the follow-up node answers the
            question your own launch retro cannot:
          </p>
          <CodeBlock>{rollupShapeSnippet}</CodeBlock>
          <p>
            Two thirds of the X traffic came from one account that is not yours. That is a
            concrete decision — who to send the next launch to before you post it — and it is
            invisible in a report where all of it reads <code>x.com</code>.
          </p>
          <p>
            <code>followup_unresolved</code> at <code>0.273</code> is doing its job too: a
            quarter of the people who said X could not name the account. On launch day that is
            expected, and it is why the number ships next to the share instead of being folded
            into it.
          </p>
        </Section>

        <Section tag="Then the payment form settles it">
          <p>
            A launch produces a signup spike, and a signup spike is not a result. The form in the
            payment flow answers the same question against people who paid, so the response joins
            to revenue with no conversion tracking to build.
          </p>
          <p>
            Comparing the two placements is the whole point:{' '}
            <strong className="font-semibold text-slate-900">
              a channel&apos;s share among payers versus its share among signups is that
              channel&apos;s conversion rate
            </strong>
            . Launch channels are exactly where those two diverge hardest — the platform that
            sent the most signups on launch day is very often the one that sent the fewest
            customers, and no incumbent produces this number because none of them ask twice.
          </p>
          <p>
            Both placements are ideally early in their flow. Asking at the end means asking only
            the people who got to the end, which under-counts every channel whose users bounce —
            and a launch channel is the most likely one to be sending exactly those people.
          </p>
        </Section>

        <Section tag="Getting started">
          <p>
            Sign in at{' '}
            <Link href="/" className="underline underline-offset-2">
              humansurvey.co
            </Link>
            , copy a key, hand it to your agent, and describe the launch.
          </p>
          <Quote>
            &ldquo;We launch Tuesday on Product Hunt, Hacker News, X, LinkedIn and two
            newsletters. Put a how-did-you-hear-about-us question in signup and in checkout, and
            when someone picks X ask whether it was us, @rennacodes or @softlaunchwk.&rdquo;
          </Quote>
          <p>
            Your agent creates both forms, writes the candidate lists and hands back the URLs to
            embed. On Wednesday: <em>&ldquo;what has come in since last night?&rdquo;</em> A month
            later: <em>&ldquo;which of them produced customers rather than signups?&rdquo;</em>
          </p>
          <p>
            What this is not: a post-launch feedback form. It does not ask what people think of
            the product, what to build next, or whether they would pay $29 — there is one
            question here, and it is where they came from.
          </p>
        </Section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            More
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              ·{' '}
              <Link href="/docs" className="underline underline-offset-2 hover:text-slate-950">
                Docs
              </Link>{' '}
              — form config, the embed contract, cursor reads, the rollup
            </li>
            <li>
              ·{' '}
              <Link
                href="/use-cases/community-feedback"
                className="underline underline-offset-2 hover:text-slate-950"
              >
                Community attribution
              </Link>{' '}
              — Reddit, Discord, Slack groups, and which community it was
            </li>
            <li>
              ·{' '}
              <Link
                href="/use-cases/events"
                className="underline underline-offset-2 hover:text-slate-950"
              >
                Event attribution
              </Link>{' '}
              — conferences and trade shows, and which of the eight it was
            </li>
            <li>
              ·{' '}
              <Link
                href="/use-cases/ai-assistants"
                className="underline underline-offset-2 hover:text-slate-950"
              >
                AI assistant attribution
              </Link>{' '}
              — ChatGPT, Claude, Perplexity and Gemini, which all arrive as Direct
            </li>
            <li>
              ·{' '}
              <Link href="/faq" className="underline underline-offset-2 hover:text-slate-950">
                FAQ
              </Link>{' '}
              — anonymity, what a form can and cannot ask, pricing
            </li>
            <li>
              ·{' '}
              <a
                href="/use-cases/product-launch.md"
                className="underline underline-offset-2 hover:text-slate-950"
              >
                View this page as markdown
              </a>{' '}
              — for agent context / LLM readers
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
