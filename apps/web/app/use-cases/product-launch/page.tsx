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

// author/publisher reference the site-wide Organization from app/layout.tsx by @id instead of
// restating it: an inline copy per page put four extra companies in the graph for a consumer
// to reconcile. The breadcrumb is here because the hierarchy is real — this page sits two
// levels deep and asserted its position nowhere.
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      '@id': 'https://www.humansurvey.co/use-cases/product-launch#article',
      headline: 'Launch attribution: which of the six places you posted actually worked',
      description:
        'Configuring a how-did-you-hear-about-us question for a launch, so Product Hunt, Hacker News and X separate, and X resolves to the specific account whose post was seen.',
      datePublished: '2026-04-20',
      author: { '@id': 'https://www.humansurvey.co/#org' },
      publisher: { '@id': 'https://www.humansurvey.co/#org' },
      mainEntityOfPage: 'https://www.humansurvey.co/use-cases/product-launch',
      isPartOf: { '@id': 'https://www.humansurvey.co/use-cases#page' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://www.humansurvey.co/use-cases/product-launch#breadcrumb',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'HumanSurvey',
          item: 'https://www.humansurvey.co',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Use cases',
          item: 'https://www.humansurvey.co/use-cases',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Launch day',
          item: 'https://www.humansurvey.co/use-cases/product-launch',
        },
      ],
    },
  ],
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

const cursorShapeSnippet = `// ILLUSTRATIVE — invented responses, to show the shape of the read
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
}`

const windowsSnippet = `# ILLUSTRATIVE — invented shares, to show what two windows can do to one answer
# launch week
GET /api/attribution/rollup?form_id=…&from=2026-05-12&to=2026-05-19
  producthunt   0.28    x   0.20    hackernews   0.16    google   0.05

# the month after it
GET /api/attribution/rollup?form_id=…&from=2026-05-19&to=2026-06-19
  producthunt   0.09    x   0.11    hackernews   0.21    google   0.18

# Product Hunt was the day. Hacker News and search were the month.
# Close the window on launch day and you conclude the opposite.`

const rollupShapeSnippet = `// ILLUSTRATIVE — every figure below is invented, to show the shape of the payload
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
}`

export default function ProductLaunchPage() {
  return (
    <main data-palette="growth" className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)] hover:text-stone-900"
          >
            ← HumanSurvey
          </Link>
          <div className="flex gap-2">
            <Link
              href="/use-cases"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
            >
              Use cases
            </Link>
            <Link
              href="/faq"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
            >
              FAQ
            </Link>
            <Link
              href="/docs"
              className="hidden min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900 sm:inline-flex"
            >
              Docs
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Use case · Launch day
          </p>
          <h1 className="text-4xl tracking-[-0.02em] text-stone-900 sm:text-5xl">
            You posted in six places. The spike came back labelled Direct.
          </h1>
          <p className="text-base leading-[1.7] text-stone-800">
            A launch is the one traffic event you most want to decompose, and the one your
            analytics is least able to. The traffic that converts mostly arrives with no referrer at
            all: from an in-app browser, or after the post was screenshotted into a group chat.{' '}
            <strong className="font-semibold text-stone-900">
              The only signal that survives all of that is asking, and the only version worth
              asking gets down to which account&apos;s post it was.
            </strong>
          </p>
        </section>

        <Section tag="Why launch traffic is the worst-attributed traffic you will ever get">
          <p>
            Every mechanism that makes a launch work also strips the evidence that it worked.
          </p>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-stone-900">
                  A UTM link only covers the link you placed.
                </strong>{' '}
                It cannot follow the copy-paste, which on launch day is most of the distribution.
              </>,
              <>
                <strong className="font-semibold text-stone-900">
                  The referrers that do arrive name a domain.
                </strong>{' '}
                <code>x.com</code> tells you a launch is happening on X. It cannot tell you that
                one quote-post did four times the work of your own announcement.
              </>,
            ]}
          />
        </Section>

        <Section tag="The configuration">
          <p>
            One form in the signup flow, one in the payment flow. Both take the same config.
          </p>
          <CodeBlock>{configSnippet}</CodeBlock>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-stone-900">
                  X expands, Product Hunt does not.
                </strong>{' '}
                A launch on X is six accounts amplifying each other; a launch on Product Hunt is
                one page.
              </>,
              <>
                <strong className="font-semibold text-stone-900">
                  No expiry, no response limit.
                </strong>{' '}
                The form sits in the flow long after the launch is over, which is the only way to
                see the tail.
              </>,
            ]}
          />
        </Section>

        <Section tag="Launch day: read the rows, not the aggregate">
          <p>
            Aggregates are the wrong shape while a launch is still happening. Pass the previous
            cursor back and you get only what has completed since — every row emitted exactly
            once.
          </p>
          <CodeBlock>{cursorSnippet}</CodeBlock>
          <CodeBlock>{cursorShapeSnippet}</CodeBlock>
          <p>
            That second row is the reason this read exists:{' '}
            <strong className="font-semibold text-stone-900">
              somebody typed a Slack group you had not listed
            </strong>
            , a channel that would otherwise have arrived as Direct forever. Free text is stored
            verbatim and stays mappable, so once you know the group exists you can resolve every
            past answer that named it.
          </p>
          <p>
            Nothing in this API ever reports that collection has finished, because a form in a
            signup flow never does.
          </p>
        </Section>

        <Section tag="A week later: the tail is the finding">
          <p>
            The most common mistake in launch attribution is measuring the launch over the
            window of the launch. Responses are windowed on when they completed, so you can ask
            the same question of two windows and watch the answer invert.
          </p>
          <CodeBlock>{windowsSnippet}</CodeBlock>
          <p>
            Only the pair is useful. The follow-up node answers the question your launch retro
            cannot:
          </p>
          <CodeBlock>{rollupShapeSnippet}</CodeBlock>
          <p>
            Renna&apos;s row is <code>0.531</code>: 51 of the 96 people who answered that
            follow-up at all. Over half named one account, and it is not yours — that is who to
            send the next launch to.
          </p>
          {/* This paragraph is here because an earlier version of the one above it said "two
              thirds", which is 51/(51+24) — the two rows that happen to be printed. Getting the
              denominator from the rows you can see rather than from the payload is the exact
              failure mode the product argues against, so the correction is shown rather than
              quietly made. */}
          <p>
            Note what the payload will not let you say. Set the 51 against the 24 who picked your
            own account and you get 68% — &ldquo;two thirds of our X traffic came from one
            account&rdquo; writes itself. It overstates by fifteen points, because it silently
            drops the twenty-one people who named a third account or could not name one.{' '}
            <code>denominator.per_node</code> ships in every payload so the base is never
            something a reader has to reconstruct.
          </p>
          <p>
            <code>followup_unresolved</code> at <code>0.273</code>: a bit over a quarter of the
            people who said X never got to a named account.
          </p>
        </Section>

        <Section tag="Then the payment form settles it">
          <p>
            A launch produces a signup spike, and a signup spike is not a result. The form in the
            payment flow answers the same question against people who paid, so the response joins
            to revenue with no conversion tracking to build.
          </p>
          <p>
            <strong className="font-semibold text-stone-900">
              Divide a channel&apos;s share of the paying population by its share of the signup
              population: above 1 it converts better than your average, below 1 worse.
            </strong>
          </p>
          <p>
            Both placements are ideally early in their flow. Asking at the end means asking only
            the people who got to the end, which under-counts every channel whose users bounce.
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
            Your agent creates both forms and hands back the URLs to embed. On Wednesday:{' '}
            <em>&ldquo;what has come in since last night?&rdquo;</em> A month later:{' '}
            <em>&ldquo;which of them produced customers rather than signups?&rdquo;</em>
          </p>
          <p>
            What this is not: a post-launch feedback form. There is one question here, and it is
            where they came from.
          </p>
        </Section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            More
          </p>
          <ul className="space-y-2 text-sm text-stone-700">
            <li>
              ·{' '}
              <Link href="/docs" className="underline underline-offset-2 hover:text-stone-900">
                Docs
              </Link>{' '}
              — form config, the embed contract, cursor reads, the rollup
            </li>
            <li>
              ·{' '}
              <Link
                href="/use-cases/community-feedback"
                className="underline underline-offset-2 hover:text-stone-900"
              >
                Community attribution
              </Link>{' '}
              — Reddit, Discord, Slack groups
            </li>
            <li>
              ·{' '}
              <Link
                href="/use-cases/events"
                className="underline underline-offset-2 hover:text-stone-900"
              >
                Event attribution
              </Link>{' '}
              — conferences and trade shows
            </li>
            <li>
              ·{' '}
              <Link
                href="/use-cases/ai-assistants"
                className="underline underline-offset-2 hover:text-stone-900"
              >
                AI assistant attribution
              </Link>{' '}
              — ChatGPT, Claude, Perplexity and Gemini, which all arrive as Direct
            </li>
            <li>
              ·{' '}
              <Link href="/faq" className="underline underline-offset-2 hover:text-stone-900">
                FAQ
              </Link>{' '}
              — anonymity, what a form can and cannot ask, pricing
            </li>
            <li>
              ·{' '}
              <a
                href="/use-cases/product-launch.md"
                className="underline underline-offset-2 hover:text-stone-900"
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
