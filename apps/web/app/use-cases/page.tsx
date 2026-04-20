import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Use cases — HumanSurvey',
  description:
    'Concrete AI-agent feedback-collection workflows: community managers collecting post-AMA input, indie makers running post-launch surveys, event organizers capturing session feedback.',
  alternates: {
    canonical: '/use-cases',
    types: { 'text/markdown': '/use-cases.md' },
  },
}

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'HumanSurvey use cases',
  description:
    'Workflows where an AI agent designs a survey, a group of humans responds, and the agent reads structured results.',
  url: 'https://www.humansurvey.co/use-cases',
}

type Item = {
  role: string
  headline: string
  body: string
  href: string | null
  status: 'live' | 'soon'
}

const items: Item[] = [
  {
    role: 'Community / brand manager',
    headline: 'Post-AMA, drop, and campaign feedback from Discord / Slack / Telegram members',
    body:
      'Run a Friday AMA. Tell Claude "send attendees a feedback form — rating, topics, what to change." Tuesday, ask "how did it land?" and get a synthesis grounded in actual response JSON.',
    href: '/use-cases/community-feedback',
    status: 'live',
  },
  {
    role: 'Indie maker / PM',
    headline: 'Post-launch feedback from early users and waitlist',
    body:
      'A week after shipping a new product to 200 beta users, have your agent collect structured feedback: why they signed up, top paper cut, ranked next-feature priorities. Pipe results straight into roadmap issues.',
    href: '/use-cases/product-launch',
    status: 'live',
  },
  {
    role: 'Event organizer',
    headline: 'Post-event feedback for conferences, meetups, webinars',
    body:
      'Rate sessions in a matrix, collect speaker feedback, capture next-event suggestions. Your agent writes the public retro grounded in real numbers.',
    href: '/use-cases/events',
    status: 'live',
  },
]

export default function UseCasesIndex() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
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

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Use cases
          </p>
          <h1 className="text-4xl font-normal tracking-[-0.015em] text-slate-950 sm:text-5xl">
            Whoever needs to hear from a crowd outside their company.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            HumanSurvey fits wherever an AI agent is already in your workflow
            and you need structured input from more than one person — members,
            customers, attendees, waitlist. Three full walkthroughs follow.
          </p>
        </section>

        <section className="space-y-4" id="walkthroughs">
          {items.map((it) => (
            <article
              key={it.role}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                  {it.role}
                </p>
                {it.status === 'soon' ? (
                  <span className="rounded-full border border-[var(--panel-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    coming soon
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-950">
                {it.headline}
              </h2>
              <p className="mt-2 text-[15px] leading-[1.7] text-slate-800">{it.body}</p>
              {it.href ? (
                <Link
                  href={it.href}
                  className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full border border-slate-900 px-4 text-xs font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white"
                >
                  Read the walkthrough →
                </Link>
              ) : null}
            </article>
          ))}
        </section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-sm leading-6 text-slate-700">
            <a
              href="/use-cases.md"
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
