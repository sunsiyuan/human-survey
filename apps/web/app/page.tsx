'use client'

import { useState } from 'react'

const sampleMarkdown = `# Product Feedback Survey

**Description:** Help us improve the next release.

## Team Workflow

**Q1. Which area needs the most attention?**

- ☐ Onboarding
- ☐ Performance
- ☐ Reporting

**Q2. What should we never change without review?**

> _______________________________________________`

type CreateSurveyResult = {
  survey_url: string
  results_url: string
  question_count: number
}

export default function Home() {
  const [markdown, setMarkdown] = useState(sampleMarkdown)
  const [result, setResult] = useState<CreateSurveyResult | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      })

      const payload = (await response.json()) as CreateSurveyResult & { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to create survey')
      }

      setResult(payload)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create survey')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.35),_transparent_50%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_42%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">
              Markdown to Survey
            </p>
          </div>
          <a
            href="https://github.com/sunsiyuan/markdown-to-survey"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-300 hover:bg-white/10"
          >
            GitHub repo
          </a>
        </header>

        <section className="grid flex-1 gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">
              Markdown to Survey in seconds
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              Write survey content once, publish a polished form and live dashboard instantly.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              MTS turns simple Markdown into respondent-friendly survey pages and shareable
              results links. Write in the format you already use, then hand the rest to the app
              or to your coding assistant.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ['1', 'Paste Markdown', 'Use headings, bold prompts, checkboxes, and text fields.'],
                ['2', 'Create Survey', 'The parser stores the schema and returns respondent and results URLs.'],
                ['3', 'Watch Results', 'Responses land in a clean dashboard with live updates.'],
              ].map(([step, title, body]) => (
                <article
                  key={step}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_-48px_rgba(14,165,233,0.6)]"
                >
                  <p className="text-sm font-semibold text-blue-200">Step {step}</p>
                  <h2 className="mt-3 text-lg font-semibold text-white">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
              <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_24px_80px_-44px_rgba(14,165,233,0.4)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Markdown syntax</h2>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                    Input
                  </span>
                </div>
                <pre className="overflow-x-auto rounded-3xl bg-black/30 p-4 text-sm leading-7 text-blue-100">
                  <code>{sampleMarkdown}</code>
                </pre>
              </section>

              <section className="rounded-[2rem] border border-blue-200/20 bg-white p-5 text-slate-900 shadow-[0_24px_80px_-44px_rgba(37,99,235,0.45)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Survey preview</h2>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs uppercase tracking-[0.2em] text-blue-600">
                    Output
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
                      Product Feedback Survey
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Help us improve the next release.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">
                      Q1. Which area needs the most attention?
                    </p>
                    <div className="mt-3 space-y-2">
                      {['Onboarding', 'Performance', 'Reporting'].map((item) => (
                        <div
                          key={item}
                          className="flex min-h-11 items-center rounded-2xl bg-blue-50 px-3 text-sm text-slate-700"
                        >
                          <span className="mr-3 h-4 w-4 rounded-full border border-blue-300 bg-white" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">
                      Q2. What should we never change without review?
                    </p>
                    <div className="mt-3 min-h-24 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400">
                      Type your answer here...
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">
                    Try it
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Paste Markdown and create a survey now.
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-6 text-slate-300">
                  This form calls <code className="rounded bg-white/10 px-1.5 py-0.5">POST /api/surveys</code>{' '}
                  and returns the respondent and results URLs.
                </p>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                <textarea
                  className="min-h-64 w-full rounded-[1.75rem] border border-white/10 bg-slate-950/70 px-5 py-4 text-sm leading-7 text-blue-100 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-400/20"
                  value={markdown}
                  onChange={(event) => setMarkdown(event.target.value)}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-300">
                    No auth, no manual schema work, just Markdown in and links out.
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="min-h-11 rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {isLoading ? 'Creating...' : 'Create survey'}
                  </button>
                </div>
              </form>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              {result ? (
                <div className="mt-4 grid gap-3 rounded-[1.75rem] border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-50 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">
                      Survey URL
                    </p>
                    <a className="mt-2 block break-all font-medium underline" href={result.survey_url}>
                      {result.survey_url}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">
                      Results URL
                    </p>
                    <a className="mt-2 block break-all font-medium underline" href={result.results_url}>
                      {result.results_url}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">
                      Questions
                    </p>
                    <p className="mt-2 text-xl font-semibold">{result.question_count}</p>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
