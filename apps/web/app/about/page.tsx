import type { Metadata } from 'next'
import Link from 'next/link'

import { CodeBlock, Unordered } from '@/components/use-cases/primitives'

/**
 * The brand hub: one page that answers what this is, who makes it, what it costs, what it
 * refuses to do, and how it differs from the alternatives — without the reader having to
 * assemble that from five other pages.
 *
 * The primary reader is a model, not a visitor. That is why it is organised as short
 * anchored sections with declarative first sentences rather than as an argument, why the
 * absences get as much room as the features (the "is this the right tool" question is
 * answered by what a thing does not do at least as often as by what it does), and why the
 * comparisons are written to be fair rather than to win — an unfair comparison is both
 * wrong and less quotable.
 *
 * Every number and every capability claim here is checkable against a shipped surface, and
 * the surface is named inline so a reader can go and check it. Nothing on this page may be
 * a statistic we did not measure. The product's entire premise is that most published
 * attribution numbers are quietly wrong.
 *
 * public/about.md is the twin and must be edited in the same change.
 */

export const metadata: Metadata = {
  title: 'About HumanSurvey — what it is, what it does not do, and how it compares',
  description:
    'HumanSurvey is an open-source self-reported attribution service: one "how did you hear about us" question embedded in a host\'s own signup or payment flow, answered down to a specific creator, show or event, and read back over an HTTP API rather than a dashboard. What it does, what it refuses to do, its known limitations, and how it compares to a DIY text field and to multi-touch attribution platforms.',
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
    <main className="min-h-screen bg-[var(--page-gradient)]">
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
            A reference page rather than a pitch. Everything below is checkable against a
            shipped surface, and the surface is named beside the claim so you can go and
            check it. Where something is not built yet, it says so.
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
            It is not a survey tool and cannot be configured into one. One single-select
            question with one optional follow-up is the entire expressive range. The general
            survey engine — five question types, a Markdown authoring syntax, a conditional
            logic engine, the <C>/api/surveys</C> endpoints — was deleted on 2026-07-30 when
            the product narrowed to attribution. Every breaking change of that pivot is
            listed on <Link href="/changelog" className="underline underline-offset-2 hover:text-slate-950">/changelog</Link>.
          </p>
        </Block>

        <Block id="problem" tag="The problem" title="Which channels are invisible, and to what">
          <p>
            A browser sends a <C>Referer</C> header when one page links to another. Several of
            the places people actually discover things never produce one:
          </p>
          <Unordered
            items={[
              'In-app browsers. A link tapped inside TikTok, Instagram or a mobile app opens in an embedded webview that usually sends no referrer, so the arrival is indistinguishable from someone typing the domain.',
              'Spoken and offline exposure. A podcast read, a conference talk, a booth conversation. There is no link to lose — the person hears a name and types it in days later.',
              'Private rooms. A Slack group, a Discord, a group chat, a forwarded DM. The exposure happens somewhere no analytics has an account, and the link is often re-pasted with its parameters stripped.',
              'AI assistants. ChatGPT, Claude, Perplexity and Gemini send no referrer, and frequently there is no click at all: the person reads your name in an answer and then searches for it, so the visit is credited to search.',
              'Word of mouth. One person telling another. No transport exists for tracking to attach to.',
            ]}
          />
          <p>
            What analytics does with all of them is the same thing: files them under{' '}
            <C>Direct</C> / <C>(none)</C> / <C>(not set)</C>, in one bucket alongside people
            typing the domain from memory and people clicking a bookmark. The bucket is not
            labelled &ldquo;unknown&rdquo;. It is labelled with a channel name, which is why
            it gets read as one.
          </p>
          <p>
            There is a second half to the problem that survives even when a referrer does
            arrive. <C>tiktok.com</C> is a platform, not a decision. If six ambassador
            accounts are running, the platform name collapses all six into one string, and
            the question a budget holder actually has — which of the six — is not answerable
            from it. The same applies to which podcast, which subreddit, which conference.
          </p>
        </Block>

        <Block id="how-it-works" tag="Mechanics" title="How it works">
          <ol className="space-y-3">
            {[
              <>
                <strong className="font-semibold text-slate-900">Get a key.</strong>{' '}
                <C>POST /api/auth/code</C> mails a six-digit code to an address you control,
                and <C>POST /api/auth/verify</C> with <C>grant: &quot;api_key&quot;</C>{' '}
                exchanges it for an <C>hs_sk_…</C> key. That is the only time the key is
                readable — only its hash is stored. Anonymous key creation does not exist.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Create a form.</strong>{' '}
                <C>POST /api/attribution/forms</C> returns an id and a respondent URL at{' '}
                <C>/s/{'{id}'}</C>. A form is a placement, not a study — one per place you
                ask.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Configure it.</strong>{' '}
                <C>PUT /api/attribution/forms/{'{id}'}</C> takes <C>nodes</C>: the question
                prompt, the candidate list, whether free text is allowed, and which
                candidates expand a follow-up. Platform rows can be sourced from the
                product-owned catalog at <C>GET /api/attribution/catalog</C> — 39 entries
                today, each with a label, a mark or monogram, and search aliases. Creator,
                show and event rows come from you, because resolving a vague memory to a
                specific person is upstream work this product does not do. Each PUT stores an
                immutable config snapshot with its own version number, so a candidate list
                edited this month never rewrites what last month&apos;s rollup says was
                shown.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Embed it.</strong> The host
                drops an iframe pointing at <C>/s/{'{id}'}?embed=1</C> into its own signup or
                payment flow and passes its own user id as <C>external_id</C>. The frame
                posts <C>mounting</C>, <C>loaded</C>, <C>resize</C>, <C>submitted</C> and{' '}
                <C>completed</C> messages to the parent window. Two placements answer
                different questions: the payment flow gives you channel against revenue with
                no conversion plumbing, and the signup flow is the only way to see the people
                a channel sends who never pay.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  The respondent answers.
                </strong>{' '}
                The first selection is a <C>POST</C> and is durable the moment it lands. The
                follow-up expands in place and arrives as a <C>PATCH</C> into the same
                response, authorised by a one-time token returned from the POST. Candidate
                order is randomised per respondent by default, &ldquo;I don&apos;t
                remember&rdquo; is pinned last and always visible, and skipping is allowed.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Read the answers.</strong>{' '}
                <C>GET /api/attribution/rollup</C> returns per-candidate counts and shares
                for a form and a date window, each share beside the denominator it was
                computed over, plus the unresolved buckets. <C>?since_seq=</C> on the
                responses route is a cursor read — one row per person, deltas only, and a row
                becomes visible only once it is complete or has been swept, so nothing is
                emitted twice. <C>?external_id=</C> looks up one identity. Free text is
                stored verbatim and can be mapped to a candidate months later, retroactively.
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
          <p>The same loop as a sequence of calls:</p>
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
          <p>
            These are decisions, not a backlog. Each one is enforced somewhere in the API, and
            asking for it back changes what the product is.
          </p>
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">No dashboard.</strong> There
                is no human-facing analytics UI, and none is planned. The aggregates are an
                API resource and your agent is the reader. The signed-in area covers accounts
                and keys only — no candidate editor, no results table.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  No multi-touch modelling.
                </strong>{' '}
                Nothing here distributes fractional credit across a path. There is one
                self-reported answer per person, and the rollup counts answers.
              </>,
              <>
                <strong className="font-semibold text-slate-900">No last touch.</strong> The
                question is where you <em>first</em> heard about us, and there is deliberately
                no second question about what finally converted you. Last touch is
                near-constant — people search the brand name — so it buys no media decision
                worth the completion rate a second framing costs.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  No outbound contact with respondents.
                </strong>{' '}
                The service returns a URL and an iframe that renders it. It never emails,
                messages or otherwise contacts a respondent, and there is no email blast, no
                auto-posting and no SMS. Getting the question in front of people is the
                host&apos;s job, through a flow the host already owns.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  No identity resolution.
                </strong>{' '}
                It renders the candidate list you supply and returns the id that was chosen.
                Matching &ldquo;the one who does the office skits&rdquo; to a person is your
                side of the line — you do it once as a remap, and it then applies to every
                past window.
              </>,
              <>
                <strong className="font-semibold text-slate-900">No cross-site tracking.</strong>{' '}
                The respondent page collects nothing about the person: no name, no email, no
                fingerprint, and no free-text question that could be repurposed to ask for
                one. The only thing that can identify a response is the <C>external_id</C>{' '}
                the host chooses to pass. Leave it out and the response is anonymous.
              </>,
              <>
                <strong className="font-semibold text-slate-900">No form builder.</strong> No
                NPS, no CSAT, no rating scales, no matrix questions, no multi-select, no
                open-ended research. Multi-select in particular is not a missing feature:
                &ldquo;select all that apply&rdquo; means select everything, which means no
                signal. How this differs from Typeform, Google Forms and SurveyMonkey is
                answered on{' '}
                <Link href="/faq" className="underline underline-offset-2 hover:text-slate-950">
                  /faq
                </Link>
                .
              </>,
              <>
                <strong className="font-semibold text-slate-900">No form lifecycle.</strong>{' '}
                No <C>max_responses</C>, no <C>expires_at</C>, no closing. An attribution form
                sits in a payment flow for months, so it is a perpetual stream. Status is{' '}
                <C>active</C> or <C>paused</C>, and pausing is reversible. Bounded windows
                live on the read side instead: the rollup takes <C>from</C> and <C>to</C>.
              </>,
              <>
                <strong className="font-semibold text-slate-900">No theme editor.</strong>{' '}
                <C>theme</C> accepts four tokens — <C>accent</C>, <C>radius</C>, <C>font</C>{' '}
                and <C>dark_mode</C> — and rejects unknown keys. There is no CSS or HTML
                plugin surface. A bounded set of parameters is a requirement of embedding in
                someone else&apos;s checkout; a GUI for authoring them is not.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  No direct Stripe or AppsFlyer integration.
                </strong>{' '}
                Conversion events are pushed by the caller to{' '}
                <C>POST /api/attribution/events</C>, batched and idempotent. The schema is
                shaped the way a direct integration would want it, so adding one later is
                additive.
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
                It records what a person says they remember, and no amount of tooling
                converts that into what they did. Recall decays, and asking late in a flow
                means asking only the people who stayed — which systematically under-counts
                any channel whose users leave early. Ask early within the flow for that
                reason.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Calibration is not computed.
                </strong>{' '}
                The way to know how much self-report under-counts is to compare it against a
                channel that has its own console reporting ground truth. That is the design,
                and it is not implemented: <C>calibration</C> comes back from the rollup as
                an explicit <C>null</C> rather than an estimate.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  <C>share_corrected</C> and <C>position_effect</C> are null too.
                </strong>{' '}
                Options shown earlier in a list are chosen more often. Under the default{' '}
                <C>rotate</C> order every option spends equal expected time at every position,
                so the raw share is unbiased by construction and no correction is needed —
                but a caller who chooses <C>fixed</C> order gets no correction and no measured
                magnitude of the effect. Both fields return <C>null</C> rather than a
                smoothed guess.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  <C>external_id</C> is host-asserted.
                </strong>{' '}
                It is whatever string the host page passes in. The service does not verify
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
                sends to it yet. Use the cursor read until that changes, and do not build on
                the field.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Rendered is treated as seen.
                </strong>{' '}
                The impressions map counts an option as shown if it was rendered, including
                below the fold. That is a known approximation in the position model, which is
                part of why its output ships with its sample size rather than on its own.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Old MCP versions still install.
                </strong>{' '}
                <C>humansurvey-mcp</C> on npm is on the 1.x line and its ten tools match the
                live API. Anything below <C>1.0.0</C> is the pre-pivot build, calling{' '}
                <C>/api/surveys</C> routes that no longer exist; those versions are deprecated
                on npm, but a pinned version or a stale lockfile still resolves one, so pin{' '}
                <C>^1</C> if you pin at all. npm and the MCP registry are two separate manual
                publishes and either can lag; the one page kept current on both is the MCP
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
            own database. This is the honest competitor, and for a lot of situations it is the
            right one.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">Where the DIY field wins:</strong>{' '}
            it costs nothing, ships in an afternoon, adds no vendor and no third-party frame
            to a checkout, and the answers stay in a table you already own. If a person is
            going to read the answers, and there are few enough answers for a person to read,
            reach for the text field. This product would be overhead.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">
              Where it stops being enough:
            </strong>
          </p>
          <Unordered
            items={[
              'Free text arrives spelled every way a person can spell it, and nothing groups it. Someone re-buckets by hand each month, and last month\'s buckets are not reproducible.',
              'A hand-written option list has one fixed order for everybody, and options near the top are chosen more often. Sort it by media spend and the data confirms the budget that produced the ordering.',
              'Skips and "I don\'t remember" usually disappear rather than being counted, so the shares have no honest denominator.',
              'Nothing joins an answer to revenue unless you build that join, and nothing follows up to turn "TikTok" into which account.',
              'A mapping you work out in month three does not apply to months one and two, because the free text was already bucketed by hand.',
            ]}
          />
          <p>
            The machinery in this product is those five things plus the question. If none of
            them is a problem you have, the field is the better tool.
          </p>
        </Block>

        <Block
          id="vs-mta"
          tag="Comparison"
          title="Versus multi-touch attribution platforms"
        >
          <p>
            Multi-touch attribution platforms observe touchpoints — clicks, pixel fires, ad
            platform callbacks, sessions — along a person&apos;s path and distribute
            fractional credit across them using a model such as linear, time decay or a fitted
            data-driven one.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">
              Where they are stronger, plainly:
            </strong>{' '}
            they record behaviour rather than memory, they count repeated exposures, they work
            at session resolution rather than one answer per person, and they connect to ad
            spend to produce a cost per acquisition. For channels that emit clicks and fire
            pixels, they are more accurate than asking, and nothing here replaces them.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">Where the two do not meet:</strong>{' '}
            a model can only assign credit among the touchpoints in its input. An exposure
            that produced no click and no referrer — a podcast read, a message in a private
            Discord, a name mentioned in an assistant&apos;s answer — is not a touchpoint it
            can see. It does not come back as unknown; that person&apos;s credit is
            distributed across whatever the model did observe, which is often the branded
            search that came afterwards. Self-report is the opposite trade: one
            low-resolution, memory-based data point per person, which can name a channel no
            pixel recorded.
          </p>
          <p>
            So they are complements rather than substitutes. If every channel you run has a
            click and a pixel behind it, you do not need this. If a large share of your
            signups lands in Direct and someone is about to make a budget decision on the
            rest, a model over the observable part cannot tell you what is in the unobservable
            part — only the person can.
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
            The site and the API are one Next.js application, backed by Postgres. The
            respondent form, the marketing pages and the endpoints all ship from the same
            repository, and the schema migrations live in it alongside them.
          </p>
        </Block>

        <Block id="pricing" tag="Pricing" title="What it costs">
          <p>
            Open source under MIT, and currently free to use at reasonable volumes. There are
            no paid plans, no published price list and no billing code in the repository
            today. Stating a tier table here would be inventing one.
          </p>
          <p>
            The intended model, written down before the first invoice rather than after: the
            billable unit will be responses collected, on volume tiers rather than feature
            tiers, attached to the account — the email address you verify to get a key. A
            response that answered the channel question and abandoned the follow-up counts,
            because the channel is known and that is real data. Feature gating forces an
            upgrade decision; volume gating follows growth instead. When pricing lands it will
            be announced up front rather than appearing on an invoice.
          </p>
          <p>
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
