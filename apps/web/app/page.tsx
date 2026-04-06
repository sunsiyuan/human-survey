import Link from 'next/link'

import { TryItPanel } from '@/components/home/TryItPanel'

const mcpConfigSnippet = `{
  "mcpServers": {
    "survey": {
      "command": "npx",
      "args": ["-y", "@mts/mcp-server"],
      "env": { "MTS_API_KEY": "mts_sk_your_key_here" }
    }
  }
}`

const apiFlowSnippet = `curl -X POST https://mts.vercel.app/api/keys \\
  -H "Content-Type: application/json" \\
  -d '{"name":"ops-agent"}'

curl -X POST https://mts.vercel.app/api/surveys \\
  -H "Authorization: Bearer mts_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"markdown":"# Incident Intake\\n\\n**Q1. Which environment is affected?**\\n\\n- ☐ Local\\n- ☐ Staging\\n- ☐ Production"}'

curl https://mts.vercel.app/api/surveys/svy_123/responses \\
  -H "Authorization: Bearer mts_sk_..." `

const mcpUsageSnippet = `create_survey({
  markdown: "# Incident Intake\\n\\n**Q1. Which environment is affected?**\\n\\n- ☐ Local\\n- ☐ Staging\\n- ☐ Production"
})

get_results({
  survey_id: "svy_123"
})`

const questionTypes = [
  ['choice', 'Known options, single or multi-select', '`☐ option`'],
  ['text', 'Free-form human explanation', '`> __________`'],
  ['scale', 'Numeric position on a range', '`[scale 0-10]`'],
  ['matrix', 'Shared options across repeated rows', 'Markdown table with `☐` cells'],
]

const links = [
  ['GitHub', 'https://github.com/sunsiyuan/markdown-to-survey'],
  ['npm: @mts/mcp-server', 'https://www.npmjs.com/package/@mts/mcp-server'],
  ['API Docs', '/docs'],
  ['OpenAPI', '/api/openapi.json'],
  ['llms.txt', '/llms.txt'],
]

function CodePanel({
  eyebrow,
  title,
  code,
}: Readonly<{
  eyebrow: string
  title: string
  code: string
}>) {
  return (
    <section className="rounded-[2rem] border border-[var(--panel-border)] bg-slate-950 p-5 shadow-[0_30px_90px_-52px_rgba(14,23,38,0.7)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h2>
        </div>
      </div>
      <pre className="overflow-x-auto rounded-[1.5rem] border border-white/10 bg-black/30 p-4 text-sm leading-7 text-[var(--accent-fg)]">
        <code>{code}</code>
      </pre>
    </section>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-full border border-[var(--panel-border)] bg-white/80 px-5 py-3 shadow-[0_18px_50px_-40px_rgba(14,23,38,0.7)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--accent-strong)]">
                Markdown to Survey
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                href="/docs"
                className="rounded-full border border-black/10 px-4 py-2 font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                Docs
              </Link>
              <a
                href="https://github.com/sunsiyuan/markdown-to-survey"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-black/10 px-4 py-2 font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                GitHub
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="rounded-[2.5rem] border border-[var(--panel-border)] bg-[var(--surface)] p-8 shadow-[0_36px_120px_-60px_rgba(14,23,38,0.48)]">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent-strong)]">
              Survey Infrastructure For AI Agents
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Your agent writes Markdown. Humans answer. You get structured JSON back.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              MTS owns one step in the AI workflow: ask humans for missing information, then return
              machine-usable results through a minimal API and MCP server.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#try-it"
                className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Get API Key
              </a>
              <Link
                href="/docs"
                className="rounded-full border border-slate-900 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white"
              >
                View Docs
              </Link>
              <a
                href="https://www.npmjs.com/package/@mts/mcp-server"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                npm: @mts/mcp-server
              </a>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                [
                  '1',
                  'Agent writes the survey',
                  'Use Markdown for speed or JSON schema for precise control.',
                ],
                [
                  '2',
                  'Humans answer on hosted pages',
                  'MTS renders the form, validates submissions, and enforces lifecycle rules.',
                ],
                [
                  '3',
                  'Agent retrieves structured results',
                  'Fetch aggregated results via API or call get_results from MCP.',
                ],
              ].map(([step, title, body]) => (
                <article
                  key={step}
                  className="rounded-[1.75rem] border border-[var(--panel-border)] bg-white/76 p-5"
                >
                  <p className="text-sm font-semibold text-[var(--accent-strong)]">Step {step}</p>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            <CodePanel
              eyebrow="Above The Fold"
              title="MCP integration in Claude Code"
              code={mcpConfigSnippet}
            />
            <section className="rounded-[2rem] border border-[var(--panel-border)] bg-white/86 p-5 shadow-[0_24px_80px_-56px_rgba(14,23,38,0.52)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Example
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Typical MCP usage
              </h2>
              <pre className="mt-4 overflow-x-auto rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--surface-muted)] p-4 text-sm leading-7 text-slate-800">
                <code>{mcpUsageSnippet}</code>
              </pre>
            </section>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <CodePanel eyebrow="HTTP API" title="Authenticate, create, then fetch results" code={apiFlowSnippet} />

          <section className="rounded-[2rem] border border-[var(--panel-border)] bg-white/86 p-6 shadow-[0_24px_80px_-56px_rgba(14,23,38,0.52)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Question Types
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Four semantic primitives, not a UI zoo.
            </h2>
            <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-[var(--panel-border)]">
              <table className="min-w-full border-collapse bg-white text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Meaning</th>
                    <th className="px-4 py-3 font-semibold">Markdown</th>
                  </tr>
                </thead>
                <tbody>
                  {questionTypes.map(([type, meaning, syntax]) => (
                    <tr key={type} className="border-t border-[var(--panel-border)]">
                      <td className="px-4 py-3 font-mono text-xs text-slate-950">{type}</td>
                      <td className="px-4 py-3 text-slate-700">{meaning}</td>
                      <td className="px-4 py-3 text-slate-700">{syntax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <TryItPanel />

        <section className="rounded-[2rem] border border-[var(--panel-border)] bg-white/86 p-6 shadow-[0_24px_80px_-56px_rgba(14,23,38,0.45)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
            Reference Links
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {links.map(([label, href]) => (
              <a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noreferrer' : undefined}
                className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                {label}
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
