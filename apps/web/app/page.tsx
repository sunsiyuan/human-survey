import Link from 'next/link'

import { Story } from '@/components/home/Story'
import { TryItPanel } from '@/components/home/TryItPanel'
import { UseCases } from '@/components/home/UseCases'
import { WhenToUse } from '@/components/home/WhenToUse'

const links = [
  ['GitHub', 'https://github.com/sunsiyuan/human-survey'],
  ['npm: humansurvey-mcp', 'https://www.npmjs.com/package/humansurvey-mcp'],
  ['Docs', '/docs'],
  ['Use cases', '/use-cases'],
  ['FAQ', '/faq'],
  ['Changelog', '/changelog'],
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
            Feedback collection, AI-native
          </p>
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
            <a
              href="https://github.com/sunsiyuan/human-survey"
              target="_blank"
              rel="noreferrer"
              className="hidden min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 sm:inline-flex"
            >
              GitHub
            </a>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            For community managers, brand teams, indie makers
          </p>
          <h1 className="mt-4 text-[2.4rem] font-normal leading-[1.1] tracking-[-0.015em] text-slate-950 sm:text-[3.75rem] sm:leading-[1.02] sm:tracking-[-0.02em]">
            Ask your audience anything.{' '}
            <br className="hidden sm:block" />
            Let your AI run the loop.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-[1.7] text-slate-800 sm:text-lg sm:leading-8">
            Stop building forms. Tell Claude (or any agent) what you want to
            learn from your members, customers, or event attendees — it designs
            the survey, hands you a share link, and reports back once responses
            land.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#try-it"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Try it
            </a>
            <a
              href="#use-cases"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-900 px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white"
            >
              See use cases
            </a>
            <Link
              href="/docs"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Docs
            </Link>
          </div>
        </section>

        {/* Story */}
        <Story />

        {/* Use cases */}
        <UseCases />

        {/* Fit signal */}
        <WhenToUse />

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
