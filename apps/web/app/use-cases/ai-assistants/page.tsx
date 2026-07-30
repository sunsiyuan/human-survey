import type { Metadata } from 'next'
import Link from 'next/link'

import {
  CodeBlock,
  Quote,
  Section,
  Unordered,
} from '@/components/use-cases/primitives'

export const metadata: Metadata = {
  title: 'Measuring ChatGPT, Claude, Perplexity and Gemini — HumanSurvey use case',
  description:
    'AI assistants send no referrer, so the signups they produce land in Direct. Ask the person instead: a ChatGPT row sitting beside Google in your own signup and payment flow, and a follow-up that captures what they were asking about.',
  alternates: {
    canonical: '/use-cases/ai-assistants',
    types: { 'text/markdown': '/use-cases/ai-assistants.md' },
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
      '@id': 'https://www.humansurvey.co/use-cases/ai-assistants#article',
      headline: 'Measuring AI-assistant referrals when there is no referrer',
      description:
        'Why ChatGPT, Claude, Perplexity and Gemini traffic lands in Direct, how to word the option so people actually pick it, and how to read the result next to revenue.',
      datePublished: '2026-07-30',
      author: { '@id': 'https://www.humansurvey.co/#org' },
      publisher: { '@id': 'https://www.humansurvey.co/#org' },
      mainEntityOfPage: 'https://www.humansurvey.co/use-cases/ai-assistants',
      isPartOf: { '@id': 'https://www.humansurvey.co/use-cases#page' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://www.humansurvey.co/use-cases/ai-assistants#breadcrumb',
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
          name: 'AI assistants',
          item: 'https://www.humansurvey.co/use-cases/ai-assistants',
        },
      ],
    },
  ],
}

const configSnippet = `{
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
}`

const rollupSnippet = `curl "https://www.humansurvey.co/api/attribution/rollup\\
?form_id=abc123efgh45&by=candidate&metric=revenue&from=2026-07-01&to=2026-08-01" \\
  -H "Authorization: Bearer hs_sk_..."`

const rowsSnippet = `// ILLUSTRATIVE — invented figures, one month of a payment-flow placement
"denominator": { "completed_responses": 1204, "per_node": { "channel": 1204, "ai_topic": 118 } },
"rows": [
  { "node_id": "channel", "candidate_id": "google",     "responses": 388, "share": 0.32, "revenue_cents": 1610000 },
  { "node_id": "channel", "candidate_id": "chatgpt",    "responses":  96, "share": 0.08, "revenue_cents":  486000 },
  { "node_id": "channel", "candidate_id": "perplexity", "responses":  21, "share": 0.02, "revenue_cents":   92000 },
  { "node_id": "channel", "candidate_id": "claude",     "responses":  14, "share": 0.01, "revenue_cents":   71000 },
  { "node_id": "channel", "candidate_id": "gemini",     "responses":   9, "share": 0.01, "revenue_cents":   38000 },
  { "node_id": "ai_topic", "candidate_id": "topic_alternatives", "responses": 51, "share": 0.43, "revenue_cents": null }
],
"unresolved": { "raw": 61, "dont_remember": 143, "skipped": 88, "per_node": { … } }`

const unresolvedSnippet = `curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/unresolved?node_id=ai_topic" \\
  -H "Authorization: Bearer hs_sk_..."
# → the phrasings people typed, grouped and counted, most frequent first:
#   "best invoicing tool for freelancers"        7
#   "alternative to <competitor>"                5
#   "how to send a quote that gets signed"       4`

export default function AiAssistantsPage() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
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
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Docs
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Use case · AI assistants
          </p>
          <h1 className="text-4xl tracking-[-0.02em] text-slate-950 sm:text-5xl">
            The only way to know ChatGPT sent them is to ask.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            ChatGPT, Claude, Perplexity and Gemini do not send a referrer. The people they
            send you arrive as <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">direct / none</code>,
            in the same bucket as someone typing your domain from memory. There is no
            percentage worth quoting here, because nobody can measure a channel that leaves
            no trace —{' '}
            <strong className="font-semibold text-slate-900">
              which is the point: no log-based method fixes this, and the size of what you
              are missing is exactly the thing you cannot see.
            </strong>{' '}
            One row in a candidate list is what makes it visible.
          </p>
        </section>

        <Section tag="Why it lands in Direct">
          <p>
            Four separate things have to go right for a referrer to survive, and with an
            assistant in the middle they mostly do not:
          </p>
          <Unordered
            items={[
              <>
                The answer is rendered in a native app or a desktop client, which is not a
                web page and has no referrer to pass on.
              </>,
              <>
                Links are opened in an in-app browser, or carry{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  rel=&quot;noreferrer&quot;
                </code>
                , or route through a redirector that drops the header.
              </>,
              <>
                The citation is a link to somebody else — a listicle, a Reddit thread, your
                own docs page — so whatever referrer does arrive names that page and not the
                assistant.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Most often, there is no click at all.
                </strong>{' '}
                The person reads a name in an answer, searches it, and lands on you from
                Google. That path is not a tracking gap you could close with better
                instrumentation — the visit genuinely came from search. The{' '}
                <em>discovery</em> happened somewhere with no log.
              </>,
            ]}
          />
          <p>
            That last one is the whole argument for asking. A perfect referrer header would
            still book this person against Google, because Google is where they clicked. Only
            the person knows the assistant was the reason, and they will tell you if you make
            it a single tap.
          </p>
        </Section>

        <Section tag="The wording is most of the work">
          <p>
            This channel is more sensitive to phrasing than any other, for a reason worth
            being precise about: people do not experience themselves as having come from an
            LLM. They asked a question, got a name, searched the name, and remember Google.
          </p>
          <Quote>
            &ldquo;AI assistant&rdquo; is a category. &ldquo;ChatGPT&rdquo; is a memory.
          </Quote>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  Use the product name, never the category.
                </strong>{' '}
                A brand name has a logo, a colour and an app icon behind it, and costs the
                respondent no translation. A category asks them to classify their own
                experience first, which is exactly the step that ends in{' '}
                <em>I don&apos;t remember</em>.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Put it beside Google, not under it.
                </strong>{' '}
                Nesting the assistants inside a &ldquo;search&rdquo; group makes the
                respondent decide whether asking ChatGPT counts as searching. The catalog&apos;s
                default channel list ships{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  chatgpt
                </code>{' '}
                as its own row, next to{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  google
                </code>
                , for that reason.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  One row per assistant, not one row for all of them.
                </strong>{' '}
                Four rows cost four lines of config and are scanned, not read — a list with
                logos is affordable in a way a list of sentences is not. Collapse them into
                one and you can never answer &ldquo;is this ChatGPT or is this all four&rdquo;,
                which is the first question anyone asks of the number.
              </>,
              <>
                Order rotates per respondent by default, so no assistant sits above Google
                for everybody and the raw share is unbiased by construction. If you pin the
                order with{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  &quot;order&quot;: &quot;fixed&quot;
                </code>
                , you inherit the position bias that comes with it.
              </>,
            ]}
          />
          <p>
            One production detail rather than a surprise later: an assistant row renders with
            a logo only if the catalog carries a mark for it, and a catalog entry that carries
            none falls back to a two-letter monogram tile. Every entry in the catalog today
            ships a mark, ChatGPT included, but that is a property of the catalog rather than a
            promise — read{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              icon_url
            </code>{' '}
            before you configure anything, rather than assuming either way:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              GET /api/attribution/catalog
            </code>{' '}
            needs no key.
          </p>
        </Section>

        <Section tag="Where the question goes">
          <p>
            Lead with the{' '}
            <strong className="font-semibold text-slate-900">payment or upgrade flow</strong>.
            The respondent has just paid, so the answer is joined to revenue with no
            conversion tracking at all, and the confirmation screen was dead space anyway.
            &ldquo;ChatGPT produced this much revenue last month&rdquo; is the sentence a
            budget holder acts on.
          </p>
          <p>
            Then run a second form in the{' '}
            <strong className="font-semibold text-slate-900">signup flow</strong>. It is the
            only way to see the people an assistant sends who never pay — and with both
            running, you can divide a channel&apos;s share of the paying population by its
            share of the signup population. Above 1 it converts better than your average,
            below 1 worse. Multiply that ratio by your overall signup-to-paid rate to get the
            channel&apos;s own rate. Nothing else reports that, because nothing else asks
            twice.
          </p>
          <p>
            Ask early inside each flow. Memory decays, and asking late means asking only the
            people who stayed: if a channel sends users who churn in week one, a
            late-placed question systematically under-counts it. A small sample is visibly
            small. A biased one is not.
          </p>
        </Section>

        <Section tag="The follow-up: what they were asking">
          <p>
            Picking a candidate can expand a follow-up in place, no page transition. Point
            the assistant rows at a node that asks what they were asking about, and what
            comes back is{' '}
            <strong className="font-semibold text-slate-900">
              a real question from a real person who then converted
            </strong>{' '}
            — a different artifact from the prompt sets an AI-visibility tool guesses at and
            scores you against. Nobody has to guess which prompts matter when the people who
            bought tell you theirs.
          </p>
          <p>
            Nothing ships preconfigured here. The assistant catalog entries carry no
            follow-up by default, and the topic list is yours, because only you know what
            your buyers ask. This is you spending one extra tap on the channel you care
            about most this month:
          </p>
          <CodeBlock>{configSnippet}</CodeBlock>
          <Unordered
            items={[
              <>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  allow_free_text
                </code>{' '}
                is where the value actually is. Your three topic buckets are a guess;
                what someone types is the phrasing. It is stored verbatim, capped at 500
                characters, and never truncated silently.
              </>,
              <>
                All four assistants expanding into one{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  ai_topic
                </code>{' '}
                node pools the topic counts across them. Give each its own node if you need
                topics per assistant — the rollup keys rows on node × candidate, so pooling
                is a decision you make in the config, not one you can undo at read time.
              </>,
              <>
                A follow-up costs a tap, so it belongs on the channels carrying spend. The
                respondent who answers the first question and walks away has still told you
                the channel, and that response counts.
              </>,
            ]}
          />
        </Section>

        <Section tag="What comes back">
          <p>
            There is no dashboard. Your agent reads the aggregate over HTTP and writes the
            note:
          </p>
          <CodeBlock>{rollupSnippet}</CodeBlock>
          <CodeBlock>{rowsSnippet}</CodeBlock>
          <p>
            Two things about that payload matter more than the row values. The{' '}
            <strong className="font-semibold text-slate-900">
              denominator ships next to the shares
            </strong>
            , so 8% is 96 of 1,204 and not a percentage of some population you have to
            infer. And the people who did not give you an answer stay visible in{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              unresolved
            </code>{' '}
            instead of being dropped from the base — dropping them would inflate every
            channel on the page, ChatGPT included.
          </p>
          <p>
            Free text arrives unresolved on purpose. Once a month, read what piled up and
            map the recurring phrasings onto a topic — retroactively, across every window
            that already went out:
          </p>
          <CodeBlock>{unresolvedSnippet}</CodeBlock>
          <p>
            A mapping is not an edit. Nothing about the stored response changes; the rollup
            resolves against the live remap table on every read, so one row fixes two months
            of history at once and revoking it moves them back.
          </p>
        </Section>

        <Section tag="What this does not tell you">
          <p>
            The product&apos;s job is not to hand you a confident percentage. Most attribution
            tools do that, and it is why nobody believes them. So, plainly:
          </p>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  It is self-report, and self-report is imperfect.
                </strong>{' '}
                People misremember, and some of them will have met your name twice. What the
                shipped numbers do is refuse to hide that: the base is always there, and{' '}
                <em>I don&apos;t remember</em> is a first-class row rather than a rounding
                error.
              </>,
              <>
                It measures <em>where they first heard</em>, not what closed them. Last touch
                is near-constant — people search your brand name — and carries no budget
                decision.
              </>,
              <>
                &ldquo;ChatGPT&rdquo; is not proof the assistant recommended you. It could
                have cited an article about you, and the respondent cannot tell the
                difference. Read the row as{' '}
                <em>this person&apos;s discovery ran through ChatGPT</em>, which is still the
                thing you were unable to see at all.
              </>,
              <>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  share_corrected
                </code>
                ,{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  position_effect
                </code>{' '}
                and{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  calibration
                </code>{' '}
                come back as explicit nulls today, not as computed numbers. Rotation already
                makes the raw share unbiased, so the correction would only serve someone who
                pinned the order — and an absent number is better than a smoothed guess.
              </>,
              <>
                Small channels are small samples. Nine Gemini responses is nine responses,
                and the payload gives you the count so you can decline to draw a conclusion
                from it.
              </>,
            ]}
          />
        </Section>

        <Section tag="Getting started">
          <p>
            Sign in, copy a key, hand it to your agent. From there it reads the catalog,
            creates one form per placement, writes the candidate lists, and gives you a URL
            to embed early in checkout and in signup. A month later you ask it how the month
            went.
          </p>
          <p>
            The endpoints, the embed contract and the full rollup shape are in the{' '}
            <Link href="/docs" className="underline underline-offset-2 hover:text-slate-950">
              docs
            </Link>
            , with{' '}
            <a href="/llms-full.txt" className="underline underline-offset-2 hover:text-slate-950">
              llms-full.txt
            </a>{' '}
            for the agent doing the work.
          </p>
        </Section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            The rest of the class
          </p>
          <p className="text-sm leading-6 text-slate-700">
            Assistants are one row in a list of channels with no referrer. The others:{' '}
            <Link
              href="/use-cases/community-feedback"
              className="underline underline-offset-2 hover:text-slate-950"
            >
              communities and word of mouth
            </Link>
            ,{' '}
            <Link
              href="/use-cases/product-launch"
              className="underline underline-offset-2 hover:text-slate-950"
            >
              launch day
            </Link>
            , and{' '}
            <Link
              href="/use-cases/events"
              className="underline underline-offset-2 hover:text-slate-950"
            >
              podcasts and events
            </Link>
            .
          </p>
          <p className="text-sm leading-6 text-slate-700">
            <a
              href="/use-cases/ai-assistants.md"
              className="underline underline-offset-2 hover:text-slate-950"
            >
              View this page as markdown
            </a>{' '}
            — for agent context / LLM readers.
          </p>
        </section>
      </div>
    </main>
  )
}
