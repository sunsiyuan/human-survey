import Link from 'next/link'

import { TryItPanel } from '@/components/home/TryItPanel'

const links = [
  ['GitHub', 'https://github.com/sunsiyuan/markdown-to-survey'],
  ['npm: humansurvey-mcp', 'https://www.npmjs.com/package/humansurvey-mcp'],
  ['Docs', '/docs'],
  ['OpenAPI', '/api/openapi.json'],
  ['llms.txt', '/llms.txt'],
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:gap-16 sm:px-6 sm:py-10 lg:px-8">

        {/* Header */}
        <header className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
            Markdown to Survey
          </p>
          <div className="flex gap-2">
            <Link
              href="/docs"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Docs
            </Link>
            <a
              href="https://github.com/sunsiyuan/markdown-to-survey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              GitHub
            </a>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Feedback collection for AI agents
          </p>
          <h1 className="mt-4 text-[2.2rem] font-semibold leading-[1.15] tracking-[-0.04em] text-slate-950 sm:text-[3.5rem] sm:leading-[1.0] sm:tracking-[-0.05em]">
            Collect structured input{' '}
            <br className="hidden sm:block" />
            from many humans.{' '}
            <br className="hidden sm:block" />
            Let agents use it.
          </h1>
          <p className="mt-6 text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">
            Agents send a schema, respondents fill out a hosted survey, agents
            get clean structured JSON back — at any scale, via REST API or MCP.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#try-it"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Try it
            </a>
            <Link
              href="/docs"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-900 px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white"
            >
              Docs
            </Link>
          </div>
        </section>

        {/* Demo */}
        <section id="try-it">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Try it
          </p>
          <TryItPanel />
        </section>

        {/* Footer links */}
        <footer className="flex flex-wrap gap-3 border-t border-[var(--panel-border)] pt-8">
          {links.map(([label, href]) => (
            <a
              key={label}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noreferrer' : undefined}
              className="text-sm text-slate-500 transition hover:text-slate-900"
            >
              {label}
            </a>
          ))}
        </footer>

      </div>
    </main>
  )
}
