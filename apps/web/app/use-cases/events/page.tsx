import type { Metadata } from 'next'
import Link from 'next/link'

import {
  CodeBlock,
  Quote,
  Section,
  Unordered,
} from '@/components/use-cases/primitives'

export const metadata: Metadata = {
  title: 'Event and trade-show attribution — HumanSurvey use case',
  description:
    'A conference conversation produces no click, no referrer and a signup days or weeks later, so search or Direct takes the credit. Ask which event, in your signup and payment flow, and tell the eight you run apart.',
  alternates: {
    canonical: '/use-cases/events',
    types: { 'text/markdown': '/use-cases/events.md' },
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
      '@id': 'https://www.humansurvey.co/use-cases/events#article',
      headline: 'Event attribution: which of the eight conferences you run actually sent them',
      description:
        'Configuring a how-did-you-hear-about-us question for conferences and trade shows, where there is no referrer to lose and the signup arrives weeks after the conversation.',
      datePublished: '2026-04-20',
      author: { '@id': 'https://www.humansurvey.co/#org' },
      publisher: { '@id': 'https://www.humansurvey.co/#org' },
      mainEntityOfPage: 'https://www.humansurvey.co/use-cases/events',
      isPartOf: { '@id': 'https://www.humansurvey.co/use-cases#page' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://www.humansurvey.co/use-cases/events#breadcrumb',
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
          name: 'Conferences and trade shows',
          item: 'https://www.humansurvey.co/use-cases/events',
        },
      ],
    },
  ],
}

// Verified against the shipping API on 2026-07-30 as the body of
// PUT /api/attribution/forms/{id}. Note the event ids carry the edition: the booth is
// bought once per instance, so KubeCon 2027 is a different line item from KubeCon 2026.
const configSnippet = `{
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
}`

const rollupSnippet = `# a wide window, because the answer arrives long after the event
curl "https://www.humansurvey.co/api/attribution/rollup\\
?form_id=abc123efgh45&by=candidate&metric=revenue&from=2026-01-01&to=2026-07-01" \\
  -H "Authorization: Bearer hs_sk_..."`

const rollupShapeSnippet = `// ILLUSTRATIVE — every figure below is invented, to show the shape of the payload
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
}`

const identitySnippet = `# revenue per event: take the rows and join on your own user id
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/responses\\
?since_seq=0&limit=500" \\
  -H "Authorization: Bearer hs_sk_..."
# each row carries external_id plus its answers:
#   { "external_id": "usr_4410", "completion": "finished",
#     "answers": [ { "node_id": "channel",     "candidate_id": "event" },
#                  { "node_id": "which_event", "candidate_id": "evt_kubecon_eu_2026" } ] }

# or one person at a time, to stamp the event onto their user record
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/responses\\
?external_id=usr_4410" \\
  -H "Authorization: Bearer hs_sk_..."`

const remapSnippet = `curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/unresolved" \\
  -H "Authorization: Bearer hs_sk_..."
# → { "entries": [ { "node_id": "which_event", "raw_normalized": "the london thing",
#                    "occurrences": 6, "variants": ["the London thing", "London dinner?"] } ], … }

curl -X POST https://www.humansurvey.co/api/attribution/forms/abc123efgh45/remaps \\
  -H "Authorization: Bearer hs_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"node_id": "which_event", "raw": "the london thing",
       "candidate_id": "evt_london_dinner_2026_03"}'
# → 201 { "resolved_responses": 6,
#          "candidate_label": "Our London dinner, March 2026" }`

export default function EventsPage() {
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
            Use case · Conferences and trade shows
          </p>
          <h1 className="text-4xl tracking-[-0.02em] text-slate-950 sm:text-5xl">
            The booth sent them. Analytics says they found you on Google.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            Events are the most expensive thing on the marketing plan and the worst tracked. There
            is no referrer to lose here, because there was never a click: someone talked to you at
            a booth, took a sticker, and signed up nine days later by typing your name into a
            browser.{' '}
            <strong className="font-semibold text-slate-900">
              Search or Direct takes the credit, which is worse than no answer — it looks like an
              answer.
            </strong>
          </p>
        </section>

        <Section tag="Why this is the hardest channel you spend on">
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  There is no digital trace at all.
                </strong>{' '}
                Not a stripped referrer, not a missing UTM — nothing. A badge scan tells you who
                you talked to, not who came back.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  A QR code only measures the people who scanned it at the booth.
                </strong>{' '}
                The ones who scan on the spot are usually collecting the giveaway.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  &ldquo;Events&rdquo; is not a channel you can act on.
                </strong>{' '}
                A company running eight a year signs for the next one six months in advance, and
                the decision is <em>which</em>.
              </>,
            ]}
          />
          <p>
            So the highest cost per lead in the plan is defended, every year, with an argument
            rather than a number.
          </p>
          <p>
            A sponsored podcast episode has the same shape and takes the same configuration: no
            link to lose, a spoken name typed in days later, and a memory of the <em>show</em>{' '}
            rather than the app it was played in. Swap the event list for a show list and
            everything below is unchanged.
          </p>
        </Section>

        <Section tag="The configuration">
          <p>
            One form in the payment or upgrade flow, one in the signup flow. The channel list
            includes the non-digital rows that no analytics tool has any equivalent of, and{' '}
            <code>event</code> is the one that expands.
          </p>
          <CodeBlock>{configSnippet}</CodeBlock>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  Event ids carry the edition, deliberately.
                </strong>{' '}
                An event id must <em>not</em> merge two instances, because you buy the booth once
                per instance and the 2027 renewal is a separate decision from the 2026 one.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Your own field events belong on the list.
                </strong>{' '}
                A dinner for twenty is a channel — if it is the line with the best return, that is
                something you will never discover while the only option on screen is &ldquo;a
                conference&rdquo;.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Aliases are how people actually name events.
                </strong>{' '}
                Nobody says &ldquo;KubeCon EU 2026&rdquo;; they say &ldquo;the one in
                London&rdquo;. Aliases are matched by the search box and never displayed.
              </>,
            ]}
          />
        </Section>

        <Section tag="Reading it back, and the window that trips people up">
          <p>
            Window the read wide. The window filters on when the <em>response</em> completed, not
            on when the event happened, so a KubeCon conversation in April shows up in whatever
            month that person finally signed up.
          </p>
          <CodeBlock>{rollupSnippet}</CodeBlock>
          <CodeBlock>{rollupShapeSnippet}</CodeBlock>
          <p>
            In that illustration the London dinner beat SaaStr Annual on people who named it —
            39 against 21 — at a fraction of the cost. Whether it beat it on customers is a
            different question: the event rows count responses, and <code>paying_responses</code>{' '}
            is reported on the channel row only.
          </p>
          <p>
            Revenue joins for free at the payment placement: the respondent has just paid, so
            pushing your own <code>paid</code> events keyed on the same user id turns heads into
            money.{' '}
            <strong className="font-semibold text-slate-900">
              Payment date does not have to fall inside the window
            </strong>{' '}
            — a September payment is summed against the channel the response recorded in July.
          </p>
        </Section>

        <Section tag="Revenue per event needs one join">
          <p>
            <code>revenue_cents</code> is reported on the channel node and is <code>null</code> on
            the event rows. A response&apos;s money belongs to the response, so booking it on
            every node the person answered would multiply your total by the number of questions
            asked — and <code>null</code> is used rather than <code>0</code>, because zero would
            be a claim.
          </p>
          <p>
            So the rollup tells you how many people named each event, and both who among them
            paid and what they paid are one join away, on an id you already own:
          </p>
          <CodeBlock>{identitySnippet}</CodeBlock>
        </Section>

        <Section tag="People will type the event name. That is fine.">
          <p>
            There is no <em>Other</em> option — if the event is not listed, they type it, and the
            text is stored verbatim. For events this happens more than anywhere else, because the
            thing people remember is a city and a month.
          </p>
          <CodeBlock>{remapSnippet}</CodeBlock>
          <p>
            The mapping is retroactive and revocable: nothing about the stored responses changes,
            and the rollup resolves free text against the live table on every read. One row fixes
            six months of history at once.
          </p>
        </Section>

        <Section tag="What the two placements tell you about an expensive booth">
          <p>
            A booth is usually the inverse of a viral channel: low volume, high value. If that
            holds for yours, the form in the signup flow shows a small share and the form in the
            payment flow a larger one.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">
              That gap, if it is there, is the argument for the booth
            </strong>
            . Divide the channel&apos;s share of the paying population by its share of the signup
            population: above 1 it converts better than your average, below 1 worse. Whether
            events beat the average is not something we have measured across customers, so treat
            it as the hypothesis the two placements exist to test.
          </p>
          <p>
            Ask early in each flow. Asking at the end of onboarding means asking only the people
            who finished, and a channel whose leads take three weeks to activate is the one most
            likely to be missing from that population.
          </p>
        </Section>

        <Section tag="Getting started">
          <p>
            Sign in at{' '}
            <Link href="/" className="underline underline-offset-2">
              humansurvey.co
            </Link>
            , copy a key, and hand it to your agent with your event calendar.
          </p>
          <Quote>
            &ldquo;Add a how-did-you-hear-about-us question to signup and to checkout. When
            someone says they met us at an event, ask which: KubeCon EU 2026, re:Invent 2025,
            DevOpsDays NYC, SaaStr, and our London dinner in March. Keep last year&apos;s events
            in the list until June.&rdquo;
          </Quote>
          <p>
            Your agent creates the forms and hands back the URLs to embed. Before the next
            sponsorship deadline:{' '}
            <em>&ldquo;how many customers came from each event, and what did they pay?&rdquo;</em>
          </p>
          <p>
            What this is not: a post-event feedback form. It does not rate sessions or poll
            attendees — there is one question here, asked of your own users inside your own
            product, and it is where they first heard about you.
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
                href="/use-cases/product-launch"
                className="underline underline-offset-2 hover:text-slate-950"
              >
                Launch attribution
              </Link>{' '}
              — Product Hunt, Hacker News, X, and the spike that lands as Direct
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
                href="/use-cases/events.md"
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
