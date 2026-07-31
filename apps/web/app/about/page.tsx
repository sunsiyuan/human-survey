import type { Metadata } from 'next'
import Link from 'next/link'

import { CodeBlock, Unordered } from '@/components/use-cases/primitives'

/**
 * The brand hub: what this is, who makes it, what it costs, what it refuses to do, and how it
 * differs from the alternatives — without the reader having to assemble that from five pages.
 *
 * The primary reader is a model, not a visitor: short anchored sections, declarative first
 * sentences, and comparisons written to be fair rather than to win. Every number and capability
 * claim is checkable against a shipped surface, and the surface is named inline.
 *
 * public/about.md is the twin and must be edited in the same change.
 */

export const metadata: Metadata = {
  title: 'About HumanSurvey — what it is, what it does not do, and how it compares',
  description:
    'HumanSurvey is an open-source self-reported attribution service: one "how did you hear about us" question inside a host\'s own signup or payment flow, answered down to a specific creator, show or event, and read back over an HTTP API. What it does, what it refuses to do, its known limitations, and how it compares to a DIY text field and to multi-touch attribution.',
  alternates: {
    canonical: '/about',
    types: { 'text/markdown': '/about.md' },
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      '@id': 'https://www.humansurvey.co/about#page',
      url: 'https://www.humansurvey.co/about',
      name: 'About HumanSurvey',
      description:
        'What HumanSurvey is, the problem it addresses, how it works, what it explicitly does not do, its known limitations, how it compares to a DIY "how did you hear about us" field and to multi-touch attribution platforms, and its licence, repository and pricing position.',
      // The site-wide graph in app/layout.tsx already publishes the Organization and the
      // SoftwareApplication. Pointing at those @ids rather than restating them is what
      // makes this page the hub: a parser that reads it once ends up holding one entity,
      // not a second copy that can drift out of agreement with the first.
      mainEntity: { '@id': 'https://www.humansurvey.co/#app' },
      publisher: { '@id': 'https://www.humansurvey.co/#org' },
      isPartOf: { '@id': 'https://www.humansurvey.co/#site' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://www.humansurvey.co/about#breadcrumb',
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
          name: 'About',
          item: 'https://www.humansurvey.co/about',
        },
      ],
    },
  ],
}

const loopSnippet = `1. POST /api/auth/code      { email }
   POST /api/auth/verify    { email, code, grant: "api_key" }   -> hs_sk_...
2. GET  /api/attribution/catalog                                # platform slugs + marks
3. POST /api/attribution/forms   { name, allowed_origins }      -> form id + /s/{id}
4. PUT  /api/attribution/forms/{id}   { nodes }                 -> config version
5. host embeds /s/{id}?embed=1&external_id=usr_8812             # signup and/or payment
6. POST /api/attribution/events  { form_id, events: [...] }     # conversion events
7. GET  /api/attribution/rollup?form_id=...&from=&to=
   GET  /api/attribution/forms/{id}/responses?since_seq=...     # row stream, deltas only
8. GET  /api/attribution/forms/{id}/unresolved                  # free text waiting
   POST /api/attribution/forms/{id}/remaps  { node_id, raw, candidate_id }`

function Block({
  id,
  tag,
  title,
  children,
}: {
  id: string
  tag: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="space-y-4 scroll-mt-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
        {tag}
      </p>
      <h2 className="text-2xl tracking-[-0.015em] text-slate-950 sm:text-3xl">{title}</h2>
      <div className="space-y-4 text-base leading-[1.8] text-slate-800">{children}</div>
    </section>
  )
}

function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">{children}</code>
  )
}

/**
 * Every value is wrapped in a fragment. The `key` that matters is supplied on the rendered
 * <div> from the term, and a fragment is the one element react/jsx-key does not ask for one
 * on — which keeps a table of plain facts from growing a column of ids nothing reads.
 */
const facts: [string, React.ReactNode][] = [
  ['Licence', <>MIT. The copyright line reads &ldquo;HumanSurvey contributors&rdquo;.</>],
  [
    'Repository',
    <>
      <a
        href="https://github.com/sunsiyuan/human-survey"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-slate-950"
      >
        github.com/sunsiyuan/human-survey
      </a>
    </>,
  ],
  [
    'npm package',
    <>
      <a
        href="https://www.npmjs.com/package/humansurvey-mcp"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-slate-950"
      >
        humansurvey-mcp
      </a>{' '}
      — 1.x on npm, matching the current API.
    </>,
  ],
  ['MCP server name', <><C>io.github.sunsiyuan/human-survey</C></>],
  ['API base', <><C>https://www.humansurvey.co/api</C></>],
  ['Respondent URL', <><C>https://www.humansurvey.co/s/{'{id}'}</C></>],
  [
    'Machine references',
    <>
      <a href="/api/openapi.json" className="underline underline-offset-2 hover:text-slate-950">
        /api/openapi.json
      </a>
      ,{' '}
      <a href="/llms.txt" className="underline underline-offset-2 hover:text-slate-950">
        /llms.txt
      </a>
      ,{' '}
      <a href="/llms-full.txt" className="underline underline-offset-2 hover:text-slate-950">
        /llms-full.txt
      </a>
    </>,
  ],
  [
    'Support',
    <>
      <a
        href="https://github.com/sunsiyuan/human-survey/issues"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-slate-950"
      >
        GitHub issues
      </a>
    </>,
  ],
]

export default function AboutPage() {
  return (
    <main data-palette="growth" className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)] hover:text-slate-900"
          >
            ← HumanSurvey
          </Link>
          <div className="flex gap-2">
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
            About
          </p>
          <h1 className="text-4xl tracking-[-0.02em] text-slate-950 sm:text-5xl">
            What HumanSurvey is, and what it refuses to do.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            Every claim below names the shipped surface it is checkable against. Where
            something is not built yet, it says so.
          </p>
        </section>

        <Block id="what-it-is" tag="Definition" title="What it is">
          <p>
            <strong className="font-semibold text-slate-900">
              HumanSurvey is an open-source self-reported attribution service: it asks one
              question — how did you hear about us — inside a host&apos;s own signup or
              payment flow, records the answer at the granularity of a specific creator, show
              or event, and returns it over an HTTP API instead of a dashboard.
            </strong>
          </p>
          <p>
            It is not a survey tool and cannot be configured into one: one single-select
            question with one optional follow-up is the entire expressive range. The general
            survey engine and its <C>/api/surveys</C> endpoints were deleted on 2026-07-30,
            when the product narrowed to attribution —{' '}
            <Link href="/changelog" className="underline underline-offset-2 hover:text-slate-950">
              /changelog
            </Link>
            .
          </p>
        </Block>

        <Block id="problem" tag="The problem" title="Which channels are invisible, and to what">
          <p>
            A browser sends a <C>Referer</C> header when one page links to another. Several of
            the places people actually discover things never produce one:
          </p>
          <Unordered
            items={[
              'In-app browsers. A link tapped inside TikTok or Instagram opens in a webview that usually sends no referrer.',
              'Spoken and offline exposure. A podcast read, a conference talk, a booth conversation. There is no link to lose — the person hears a name and types it in days later.',
              'Private rooms. A Slack group, a Discord, a forwarded DM. The link is often re-pasted with its parameters stripped.',
              'AI assistants. ChatGPT, Claude, Perplexity and Gemini send no referrer, and frequently there is no click at all: the person reads your name in an answer and then searches for it, so the visit is credited to search.',
              'Word of mouth. One person telling another. No transport exists for tracking to attach to.',
            ]}
          />
          <p>
            Analytics files all of them under <C>Direct</C> / <C>(none)</C> / <C>(not set)</C>,
            alongside people typing the domain from memory. The bucket is not labelled{' '}
            &ldquo;unknown&rdquo;. It is labelled with a channel name, which is why it gets
            read as one.
          </p>
          <p>
            The second half of the problem survives even when a referrer does arrive.{' '}
            <C>tiktok.com</C> is a platform, not a decision. If six ambassador accounts are
            running, the platform name collapses all six into one string, and the question a
            budget holder has — which of the six — is not answerable from it.
          </p>
        </Block>

        <Block id="how-it-works" tag="Mechanics" title="How it works">
          <p>
            You create one form for each place you ask — a form is a placement, not a study —
            and then:
          </p>
          <ol className="space-y-3">
            {[
              <>
                <strong className="font-semibold text-slate-900">Configure it.</strong> The
                prompt, the candidate list, and which candidates expand a follow-up. Platform
                rows can come from the catalog at <C>GET /api/attribution/catalog</C>, 39
                entries today; creator, show and event rows come from you. Each PUT stores
                an immutable snapshot, so a list edited this month never rewrites what last
                month&apos;s rollup says was shown.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Embed it.</strong> An iframe
                at <C>/s/{'{id}'}?embed=1</C> inside your own signup or payment flow, with
                your user id passed as <C>external_id</C>. Payment gives you channel against
                revenue with no conversion plumbing; signup is the only way to see the people
                a channel sends who never pay.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  The respondent answers.
                </strong>{' '}
                Candidate order is randomised per respondent by default, &ldquo;I don&apos;t
                remember&rdquo; is pinned last and always visible, and skipping is allowed.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Read the answers.</strong>{' '}
                The rollup returns per-candidate counts and shares for a date window, each
                share beside the denominator it was computed over, plus the unresolved
                buckets. Free text is stored verbatim and can be mapped to a candidate months
                later, retroactively.
              </>,
            ].map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-[3px] shrink-0 font-mono text-[11px] text-[var(--accent)]">
                  0{i + 1}
                </span>
                <span className="text-slate-800">{item}</span>
              </li>
            ))}
          </ol>
          <p>The whole loop as a sequence of calls:</p>
          <CodeBlock>{loopSnippet}</CodeBlock>
          <p>
            Full request and response shapes are on{' '}
            <Link href="/docs" className="underline underline-offset-2 hover:text-slate-950">
              /docs
            </Link>{' '}
            and in the OpenAPI 3 document at{' '}
            <a href="/api/openapi.json" className="underline underline-offset-2 hover:text-slate-950">
              /api/openapi.json
            </a>
            .
          </p>
        </Block>

        <Block id="not" tag="Boundaries" title="What it does not do">
          <p>These are decisions, not a backlog, and each is enforced somewhere in the API.</p>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">No theme editor.</strong>{' '}
                <C>theme</C> accepts four tokens — <C>accent</C>, <C>radius</C>, <C>font</C>{' '}
                and <C>dark_mode</C> — and rejects unknown keys. There is no CSS or HTML
                plugin surface: a bounded set of parameters is a requirement of embedding in
                someone else&apos;s checkout.
              </>,
              <>
                <strong className="font-semibold text-slate-900">No dashboard.</strong> No
                human-facing analytics UI, and none is planned. The aggregates are an API
                resource and your agent is the reader.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  No multi-touch modelling.
                </strong>{' '}
                One self-reported answer per person, and the rollup counts answers.
              </>,
              <>
                <strong className="font-semibold text-slate-900">No last touch.</strong> The
                question is where you <em>first</em> heard about us. Last touch is
                near-constant — people search the brand name — so a second question costs
                completion rate and buys no media decision.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  No outbound contact with respondents.
                </strong>{' '}
                The service returns a URL and an iframe that renders it; it never emails,
                messages or otherwise contacts a respondent. Getting the question in front of
                people is the host&apos;s job.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  No identity resolution.
                </strong>{' '}
                It renders the candidate list you supply and returns the id that was chosen.
                Matching &ldquo;the one who does the office skits&rdquo; to a person is your
                side of the line — you do it once as a remap, and it applies to every past
                window.
              </>,
              <>
                <strong className="font-semibold text-slate-900">No cross-site tracking.</strong>{' '}
                The respondent page collects no name, no email and no fingerprint, and asks no
                free-text question that could be repurposed to ask for one. The only thing
                that can identify a response is the <C>external_id</C> the host passes. Leave
                it out and the response is anonymous.
              </>,
              <>
                <strong className="font-semibold text-slate-900">No form builder.</strong> No
                NPS, no CSAT, no rating scales, no multi-select. &ldquo;Select all that
                apply&rdquo; means select everything, which means no signal. How this differs
                from Typeform, Google Forms and SurveyMonkey is answered on{' '}
                <Link href="/faq" className="underline underline-offset-2 hover:text-slate-950">
                  /faq
                </Link>
                .
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  No direct Stripe or AppsFlyer integration.
                </strong>{' '}
                Conversion events are pushed by the caller to{' '}
                <C>POST /api/attribution/events</C>, batched and idempotent.
              </>,
            ]}
          />
        </Block>

        <Block id="limitations" tag="Limitations" title="What is genuinely limited, and what is not built">
          <p>
            The first item is inherent to the method and will never be fixed. The rest are
            current state, and each is observable in a response body today.
          </p>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  Self-report is memory, not behaviour.
                </strong>{' '}
                It records what a person says they remember, not what they did. Recall decays,
                and asking late in a flow means asking only the people who stayed — which
                under-counts any channel whose users leave early. Ask early in the flow.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Calibration is not computed.
                </strong>{' '}
                Knowing how much self-report under-counts means comparing it against a channel
                whose own console reports ground truth. That is the design; it is not
                implemented. <C>calibration</C> comes back from the rollup as an explicit{' '}
                <C>null</C> rather than an estimate.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  <C>share_corrected</C> and <C>position_effect</C> are null too.
                </strong>{' '}
                Options shown earlier in a list are chosen more often. Under the default{' '}
                <C>rotate</C> order every option spends equal expected time at every position,
                so the raw share is unbiased by construction — but a caller who chooses{' '}
                <C>fixed</C> order gets no correction and no measured magnitude of the effect.
                Both fields return <C>null</C> rather than a smoothed guess.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  <C>external_id</C> is host-asserted.
                </strong>{' '}
                It is whatever string the host page passes in; the service does not verify
                that it identifies anyone, and it is not backfillable — a response collected
                without one can never be joined to a user later. It is deliberately not
                unique, so a retake is allowed; the rollup counts the first response per{' '}
                <C>(form_id, external_id)</C>.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  The per-response webhook does not deliver.
                </strong>{' '}
                <C>per_response_webhook_url</C> is accepted, validated and stored, and nothing
                sends to it yet. Use the <C>?since_seq=</C> read on the responses route; do not build on the field.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Rendered is treated as seen.
                </strong>{' '}
                The impressions map counts an option as shown if it was rendered, including
                below the fold — a known approximation in the position model.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  The MCP package is current.
                </strong>{' '}
                <C>humansurvey-mcp</C> is published on npm at 1.x and its ten attribution
                tools match the live API. Versions below <C>1.0.0</C> are the pre-pivot build
                calling deleted <C>/api/surveys</C> routes; they are deprecated but a stale
                lockfile can still resolve one. The page kept current on this is the MCP
                answer on{' '}
                <Link href="/faq" className="underline underline-offset-2 hover:text-slate-950">
                  /faq
                </Link>
                .
              </>,
            ]}
          />
        </Block>

        <Block
          id="vs-diy"
          tag="Comparison"
          title="Versus a DIY “how did you hear about us” field"
        >
          <p>
            A text input or a <C>&lt;select&gt;</C> on your own signup form, writing to your
            own database. This is the honest competitor: it costs nothing, ships in an
            afternoon, adds no third-party frame to a checkout, and the answers stay in a
            table you already own. If there are few enough answers for a person to read, reach
            for the text field. This product would be overhead.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">
              Where it stops being enough:
            </strong>
          </p>
          <Unordered
            items={[
              'Free text arrives spelled every way a person can spell it, and nothing groups it. Last month\'s hand-made buckets are not reproducible.',
              'A hand-written option list has one fixed order for everybody, and options near the top are chosen more often. Sort it by media spend and the data confirms the budget that produced the ordering.',
              'Skips and "I don\'t remember" usually disappear rather than being counted, so the shares have no honest denominator.',
              'Nothing joins an answer to revenue, and nothing follows up to turn "TikTok" into which account.',
              'A mapping you work out in month three does not apply to months one and two.',
            ]}
          />
          <p>The machinery in this product is those five things plus the question.</p>
        </Block>

        <Block
          id="vs-mta"
          tag="Comparison"
          title="Versus multi-touch attribution platforms"
        >
          <p>
            Multi-touch attribution platforms observe touchpoints — clicks, pixel fires, ad
            platform callbacks — along a person&apos;s path and distribute fractional credit
            across them.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">
              Where they are stronger, plainly:
            </strong>{' '}
            they record behaviour rather than memory, they count repeated exposures, and they
            connect to ad spend to produce a cost per acquisition. For channels that emit
            clicks and fire pixels, they are more accurate than asking, and nothing here
            replaces them.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">Where the two do not meet:</strong>{' '}
            a model can only assign credit among the touchpoints in its input. An exposure
            that produced no click and no referrer is not a touchpoint it can see, and it does
            not come back as unknown — that person&apos;s credit is distributed across
            whatever the model did observe, which is often the branded search that came
            afterwards.
          </p>
          <p>
            Self-report is the opposite trade: one low-resolution, memory-based data point per
            person, which can name a channel no pixel recorded. They are complements, not
            substitutes. If every channel you run has a click and a pixel behind it, you do
            not need this.
          </p>
        </Block>

        <Block id="technical" tag="Facts" title="Technical facts">
          <dl className="grid gap-3 sm:grid-cols-2">
            {facts.map(([term, value]) => (
              <div
                key={term}
                className="rounded-[1rem] border border-[var(--panel-border)] bg-[var(--surface)] p-3"
              >
                <dt className="text-sm font-semibold text-slate-950">{term}</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
          <p>
            The site and the API are one Next.js application backed by Postgres, shipped from
            one repository.
          </p>
        </Block>

        <Block id="pricing" tag="Pricing" title="What it costs">
          <p>
            Open source under MIT, and currently free to use at reasonable volumes. There are
            no paid plans, no published price list and no billing code in the repository
            today.
          </p>
          <p>
            The intended model, for when there is one: responses collected, on volume tiers
            rather than feature tiers, announced up front rather than appearing on an invoice.
            Because it is MIT-licensed, self-hosting is always available as an alternative to
            whatever the hosted service eventually charges.
          </p>
        </Block>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Where to go next
          </p>
          <p className="text-sm leading-6 text-slate-700">
            <Link href="/docs" className="underline underline-offset-2 hover:text-slate-950">
              /docs
            </Link>{' '}
            for endpoints and the embed contract,{' '}
            <Link href="/faq" className="underline underline-offset-2 hover:text-slate-950">
              /faq
            </Link>{' '}
            for the questions buyers actually ask,{' '}
            <Link href="/use-cases" className="underline underline-offset-2 hover:text-slate-950">
              /use-cases
            </Link>{' '}
            for four worked configurations, and{' '}
            <Link href="/changelog" className="underline underline-offset-2 hover:text-slate-950">
              /changelog
            </Link>{' '}
            for what changed when.
          </p>
          <p className="text-sm leading-6 text-slate-700">
            <a href="/about.md" className="underline underline-offset-2 hover:text-slate-950">
              View this page as markdown
            </a>{' '}
            — for agent context / LLM readers.
          </p>
        </section>
      </div>
    </main>
  )
}
