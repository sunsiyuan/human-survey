import type { Metadata } from 'next'
import Link from 'next/link'

import {
  CodeBlock,
  Quote,
  Section,
  Unordered,
} from '@/components/use-cases/primitives'

export const metadata: Metadata = {
  title: 'Attribution for community-led growth — HumanSurvey use case',
  description:
    'Reddit, Discord, Slack groups and Hacker News either send no referrer at all or send one stripped to the platform. Ask the person which community, in your payment and signup flow, and read it back as revenue per community.',
  alternates: {
    canonical: '/use-cases/community-feedback',
    types: { 'text/markdown': '/use-cases/community-feedback.md' },
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
      '@id': 'https://www.humansurvey.co/use-cases/community-feedback#article',
      headline: 'Attribution for community-led growth: which community, not which platform',
      description:
        'Configuring a how-did-you-hear-about-us question for community-led growth, so Reddit resolves to a subreddit and a Slack group resolves to a named group.',
      datePublished: '2026-04-20',
      author: { '@id': 'https://www.humansurvey.co/#org' },
      publisher: { '@id': 'https://www.humansurvey.co/#org' },
      mainEntityOfPage: 'https://www.humansurvey.co/use-cases/community-feedback',
      isPartOf: { '@id': 'https://www.humansurvey.co/use-cases#page' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://www.humansurvey.co/use-cases/community-feedback#breadcrumb',
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
          name: 'Community-led growth',
          item: 'https://www.humansurvey.co/use-cases/community-feedback',
        },
      ],
    },
  ],
}

// Verified against the shipping API on 2026-07-30: POST /api/attribution/forms, then this
// as the body of PUT /api/attribution/forms/{id}. Every candidate id here is caller-defined
// and every catalog_slug is a real row in GET /api/attribution/catalog.
const configSnippet = `{
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
}`

const putSnippet = `curl -X PUT https://www.humansurvey.co/api/attribution/forms/abc123efgh45 \\
  -H "Authorization: Bearer hs_sk_..." \\
  -H "Content-Type: application/json" \\
  -d @channels.json
# → 200 { "id": "abc123efgh45", "version": 3, "created": true, "warnings": [] }`

const rollupSnippet = `curl "https://www.humansurvey.co/api/attribution/rollup\\
?form_id=abc123efgh45&by=candidate&metric=revenue&from=2026-07-01&to=2026-08-01" \\
  -H "Authorization: Bearer hs_sk_..."`

const rollupShapeSnippet = `// ILLUSTRATIVE — every figure below is invented, to show the shape of the payload
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
}`

// The payment column has to agree with the rollup payload above it — reddit is 0.33 there —
// or the page publishes two different invented values for one quantity and a reader picks
// whichever they read last.
const ratioSnippet = `# ILLUSTRATIVE — invented figures, to show the arithmetic
# same channel, two placements, one month
                        signup form   payment form
  reddit                      0.51          0.33     ← sends volume, converts poorly
  hackernews                  0.12          0.19
  slack (Kubernetes)          0.04          0.11     ← smallest list, best rate

# reddit's share among payers / its share among signups = 0.33 / 0.51 = 0.65.
# Below 1, so reddit converts worse than your average — and the ratio is an index
# against that average, not a rate. Multiply 0.65 by your overall signup-to-paid
# rate to get reddit's own rate: at an overall 14%, reddit converts at 9.1%.
# Nothing computes it for you: it is two rollup calls and a division.`

const remapSnippet = `# what people typed instead of picking, most frequent first
curl "https://www.humansurvey.co/api/attribution/forms/abc123efgh45/unresolved?limit=50" \\
  -H "Authorization: Bearer hs_sk_..."
# → { "entries": [ { "node_id": "slack_group", "raw_normalized": "the k8s slack",
#                    "occurrences": 9, "variants": ["the k8s slack", "K8s Slack"] } ], … }

# map it — retroactive, so every past window moves with it
curl -X POST https://www.humansurvey.co/api/attribution/forms/abc123efgh45/remaps \\
  -H "Authorization: Bearer hs_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"node_id": "slack_group", "raw": "the k8s slack",
       "candidate_id": "slack_k8s"}'
# → 201 { "resolved_responses": 9, "candidate_label": "Kubernetes", "warnings": [] }`

export default function CommunityFeedbackPage() {
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
            Use case · Community-led growth
          </p>
          <h1 className="text-4xl tracking-[-0.02em] text-slate-950 sm:text-5xl">
            &ldquo;Reddit&rdquo; is not an answer. r/selfhosted is.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            Community-led growth is the hardest thing on your dashboard to measure and the
            cheapest thing you do. A Slack group leaves no trace whatsoever. A Discord link
            arrives with nothing attached. And where a referrer <em>does</em> survive — Reddit
            in a desktop browser — it names the platform and stops there.{' '}
            <strong className="font-semibold text-slate-900">
              This page configures the one question that gets past all of it, and gets past it
              at the granularity of the specific community.
            </strong>
          </p>
        </section>

        <Section tag="What actually reaches your analytics">
          <p>
            Four different things can happen when someone clicks through from a community, and
            only one of them tells you which community it was.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--panel-border)] text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4 py-3 font-semibold">Path in</th>
                  <th className="px-4 py-3 font-semibold">What arrives</th>
                  <th className="px-4 py-3 font-semibold">What you can conclude</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    Reddit, desktop browser
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]">
                    https://www.reddit.com/
                  </td>
                  <td className="px-4 py-3">
                    The platform. Browsers trim a cross-origin referrer to the origin by
                    default, so the subreddit is gone before the request leaves.
                  </td>
                </tr>
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    Reddit app, Slack, Discord
                  </td>
                  <td className="px-4 py-3">Nothing</td>
                  <td className="px-4 py-3">Direct.</td>
                </tr>
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    A UTM link you posted
                  </td>
                  <td className="px-4 py-3">The campaign you tagged</td>
                  <td className="px-4 py-3">
                    Only the link you controlled. Not the reshare, not the DM, not the person
                    who typed your name in three days later.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">Asking the person</td>
                  <td className="px-4 py-3 font-mono text-[12px]">
                    reddit → r/selfhosted
                  </td>
                  <td className="px-4 py-3">
                    The community. Survives the app, the DM, and the three-day gap.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            The UTM row is the one worth staring at. It works, and it measures exactly the
            fraction of community traffic that came through a link you personally placed — which
            in a healthy community is the minority, because the value of a community is other
            people repeating you.
          </p>
        </Section>

        <Section tag="Why the follow-up question is the whole point">
          <p>
            Suppose you learn that 33% of your paying customers first heard about you on Reddit.
            You now know one useful thing and can act on none of it: you cannot post more in
            &ldquo;Reddit&rdquo;. The decisions available to you are about specific communities —
            which subreddit to show up in weekly, which Slack group deserves a person rather
            than a link, whether r/sysadmin was ever worth the time.
          </p>
          <p>
            So the form asks twice. Picking Reddit expands a second list in place, no page
            transition, and the response is durable before the second list even appears. Hacker
            News does not expand, because there is only one Hacker News and a second question
            there costs a click and returns nothing.{' '}
            <strong className="font-semibold text-slate-900">
              Which channels earn the follow-up is a monthly judgment, not a fixed property
            </strong>{' '}
            — that is a config edit, and it is the reason an agent maintains this list rather
            than a form builder.
          </p>
        </Section>

        <Section tag="The configuration">
          <p>
            A form is one placement. Create it, then <code>PUT</code> the candidate list —{' '}
            <code>catalog_slug</code> pulls the label, the mark and the search aliases out of
            the platform catalog so you only type the things that are yours.
          </p>
          <CodeBlock>{configSnippet}</CodeBlock>
          <CodeBlock>{putSnippet}</CodeBlock>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  Subreddit names are their own stable key.
                </strong>{' '}
                A subreddit cannot be renamed, so <code>r/selfhosted</code> is safe as an id. A
                Slack group is not — the workspace can be renamed, which is why those ids are
                internal (<code>slack_k8s</code>) and the pretty name lives in{' '}
                <code>label</code>. Ids are yours and are validated, never minted, so a rename
                never splits a community&apos;s history in two.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  A missing community does not cost you one data point.
                </strong>{' '}
                It contaminates a neighbour: someone who found you in a Slack group and then
                searched picks Google, so you lose the group and book a false entry against
                search. Ten to twelve rows with logos scan faster than six rows of text, and{' '}
                <code>aliases</code> — matched, never displayed — catch the people who remember
                a description rather than a name.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Order is randomized per respondent by default.
                </strong>{' '}
                Options near the top get picked more often; rotating means no community sits at
                the top for everybody, so the raw share is unbiased without any correction being
                applied to it afterwards.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  &ldquo;I don&apos;t remember&rdquo; stays visible and last.
                </strong>{' '}
                Given a list and a search box, someone who does not remember will pick
                something, and that is worse than a smaller sample — it is noise wearing the
                costume of signal.
              </>,
            ]}
          />
        </Section>

        <Section tag="What comes back">
          <p>
            One aggregate read, computed in SQL at read time. There is no dashboard by design:
            the agent already in your terminal is the thing that reads this.
          </p>
          <CodeBlock>{rollupSnippet}</CodeBlock>
          <CodeBlock>{rollupShapeSnippet}</CodeBlock>
          <p>
            The denominator ships in the payload, so the resolved rows sum to less than one and
            the remainder is the <code>unresolved</code> block. That is deliberate: a reader who
            has to guess whether 33% already excludes the don&apos;t-knows will guess wrong, and
            in the direction that flatters every channel.
          </p>
          <p>
            <code>followup_unresolved</code> is the number to watch in the first week. It is the
            share of Reddit picks that never resolved to a subreddit — coverage of your candidate
            list, reported without your having to instrument anything. High and steady usually
            means the list is missing the community people actually came from.
          </p>
        </Section>

        <Section tag="Two placements, and the number neither gives alone">
          <p>
            Run one form in the payment or upgrade flow and one in the signup flow. The payment
            one is where the money is: the respondent has just paid, so the answer joins to
            revenue with no conversion tracking at all, and the confirmation page was dead space
            anyway.
          </p>
          <p>
            The signup one is the only way to see the people a community sends who never pay.
            Ask only at payment and you can never learn that a subreddit delivers volume that
            does not convert — which is exactly the judgment that ends a channel.
          </p>
          <CodeBlock>{ratioSnippet}</CodeBlock>
          <p>
            Ask early in each flow. Memory decays, but the worse problem is that asking late
            means asking only the people who stayed, which systematically under-counts any
            community whose users churn early. A small sample is visibly small; a biased one is
            not.
          </p>
        </Section>

        <Section tag="Free text is where you find the community you never listed">
          <p>
            There is no <em>Other</em> option — if it is not in the list, people type. That text
            is stored verbatim and never normalized on the way in, and the most valuable thing
            attribution ever produces shows up here first: a community you had not thought to
            list.
          </p>
          <CodeBlock>{remapSnippet}</CodeBlock>
          <p>
            A mapping is not an edit. Nothing about the stored responses changes — the rollup
            resolves free text against the live mapping table on every read, so one row fixes
            three months of history at once and revoking it moves them back.{' '}
            <code>resolved_responses</code> tells you exactly how many responses just moved, so
            &ldquo;I mapped it and nothing changed&rdquo; is visible immediately rather than next
            quarter.
          </p>
        </Section>

        <Section tag="Getting started">
          <p>
            Sign in at{' '}
            <Link href="/" className="underline underline-offset-2">
              humansurvey.co
            </Link>
            , copy a key, and hand it to your agent. That is the whole human part.
          </p>
          <Quote>
            &ldquo;Set up attribution on our upgrade page. Our communities are r/selfhosted,
            r/devops, r/kubernetes and the Kubernetes and MLOps Slacks — ask which one when
            someone picks Reddit or Slack. Also list Hacker News, GitHub, X, Google, ChatGPT and
            word of mouth.&rdquo;
          </Quote>
          <p>
            Your agent reads the platform catalog, creates the form, writes the candidate lists
            and hands back a URL to embed. A month later:{' '}
            <em>&ldquo;which communities produced revenue, and which only produced signups?&rdquo;</em>
          </p>
          <p>
            What this is not: a place to ask your members what they thought of the AMA. There is
            one question here — where did you first hear about us — and no arbitrary
            questionnaire behind it.
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
                href="/use-cases/community-feedback.md"
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
