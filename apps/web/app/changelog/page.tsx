import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Changelog — HumanSurvey',
  description:
    'What has shipped in HumanSurvey, dated by release. Agent-first feedback collection infrastructure for AI agents.',
  alternates: { canonical: '/changelog' },
}

type Entry = {
  date: string
  version?: string
  title: string
  items: string[]
}

const entries: Entry[] = [
  {
    date: '2026-04-20',
    title: 'Topical cluster completion + markdown twins + Organization graph',
    items: [
      'Added two long-form use-case walkthroughs: /use-cases/product-launch (indie maker / PM) and /use-cases/events (conference / meetup organizer).',
      'Each use-case page has an Article JSON-LD node with a dated worked example (schema in → synthesis out).',
      'Shipped markdown twins at /faq.md, /use-cases.md, /use-cases/community-feedback.md, /use-cases/product-launch.md, /use-cases/events.md — served alongside each HTML page for LLM crawlers that prefer markdown.',
      'Wired content negotiation via Next.js alternates.types so well-behaved agents can request the markdown form of any canonical page.',
      'Upgraded the site-wide JSON-LD to a @graph with an Organization node (sameAs: GitHub, npm, Glama) and a SoftwareApplication node linked via publisher — stronger entity signal for search and LLM indexes.',
      'Sitemap now enumerates all HTML routes and .md twin URLs.',
    ],
  },
  {
    date: '2026-04-20',
    title: 'Landing rewrite + FAQ for external-audience personas',
    items: [
      'Retargeted the landing page to community/brand managers and indie makers — external audiences, not internal teams.',
      'Added a /faq page with 11 natural-language Q&As and schema.org FAQPage JSON-LD.',
      'Expanded /llms.txt with user-phrasing examples, comparison vs form builders, and an explicit distribution-boundary statement.',
      'Added a worked community-feedback use case walkthrough at /use-cases/community-feedback.',
    ],
  },
  {
    date: '2026-04-09',
    version: 'v0.2.0',
    title: 'create_key MCP tool — agents self-provision API keys',
    items: [
      'New create_key MCP tool lets agents provision their own HumanSurvey API key with optional owner email and CAIP-10 wallet address.',
      'No human setup required — an agent can bootstrap the full create_survey → get_results loop from a single Claude Code install.',
      'Wallet address captured up front for future x402-style agent-native billing.',
    ],
  },
  {
    date: '2026-04-08',
    title: 'Observability, demo hardening, and packaging',
    items: [
      'Daily metrics script + GitHub Actions workflow; Telegram push notifications.',
      'Tagged demo-origin surveys with a source column to keep production metrics clean.',
      'Added Dockerfile and glama.json for Glama MCP directory listing.',
      'Renamed API key prefix from mts_sk_ to hs_sk_ (and all env vars) alongside the HumanSurvey rebrand.',
    ],
  },
  {
    date: '2026-04-07',
    title: 'humansurvey.co launch — schema-only API and agent-first UX',
    items: [
      'Rebranded from markdown-to-survey (MTS) to HumanSurvey; live at humansurvey.co.',
      'Switched to a schema-only API surface — markdown parsing moved to an LLM demo endpoint.',
      'MCP package published as humansurvey-mcp on npm.',
      'Webhooks fire on survey close; mobile layout + copy-button fixes for the demo panel.',
      'Repositioned as "feedback collection for AI agents" end-to-end in docs and product copy.',
    ],
  },
  {
    date: '2026-03',
    version: 'v0.1.0',
    title: 'MVP — markdown to survey, MCP server, results dashboard',
    items: [
      'Initial monorepo (parser + Next.js app + MCP server).',
      'Markdown-to-schema parser with single_choice, multi_choice, text, scale, and matrix question types.',
      'Public respondent page at /s/{id} with localStorage draft recovery.',
      'Results page at /r/{result_id} with live Supabase Realtime updates.',
      'MCP server shipped with create_survey and get_results tools.',
    ],
  },
]

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
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
            Changelog
          </p>
          <h1 className="text-4xl font-normal tracking-[-0.015em] text-slate-950 sm:text-5xl">
            What&apos;s shipped.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            Dated releases since the MVP. Tracked publicly so humans and agents
            alike can tell the project is alive and moving.
          </p>
        </section>

        <section className="space-y-6">
          {entries.map((e) => (
            <article
              key={e.date + e.title}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <time
                  dateTime={e.date}
                  className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--accent)]"
                >
                  {e.date}
                </time>
                {e.version ? (
                  <span className="rounded-full border border-[var(--panel-border)] px-2 py-0.5 font-mono text-[11px] text-slate-600">
                    {e.version}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-950">
                {e.title}
              </h2>
              <ul className="mt-3 space-y-2 text-[15px] leading-[1.7] text-slate-800">
                {e.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-sm leading-6 text-slate-600">
            For the live commit log, see the{' '}
            <a
              href="https://github.com/sunsiyuan/human-survey/commits/main"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-slate-950"
            >
              GitHub history
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  )
}
