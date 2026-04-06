import Link from 'next/link'

import { TryItPanel } from '@/components/home/TryItPanel'

const mcpConfigSnippet = `{
  "mcpServers": {
    "survey": {
      "command": "npx",
      "args": ["-y", "@mts/mcp-server"],
      "env": {
        "MTS_API_KEY": "mts_sk_your_key_here"
      }
    }
  }
}`

const apiFlowSnippet = `POST /api/keys
POST /api/surveys
GET  /api/surveys/{id}/responses

Authorization: Bearer mts_sk_...`

const mcpUsageSnippet = `create_survey({
  schema: {
    title: "Incident Intake",
    sections: [...]
  }
})

get_results({
  survey_id: "svy_123"
})`

const workflowSteps = [
  {
    title: 'Create the request',
    body: 'Send Markdown for speed or JSON schema when the agent already has structure.',
  },
  {
    title: 'Collect human input',
    body: 'MTS hosts the respondent page, applies validation, and tracks the survey lifecycle.',
  },
  {
    title: 'Continue with results',
    body: 'Fetch normalized output from the API or call get_results through MCP.',
  },
]

const primitives = [
  {
    name: 'choice',
    detail: 'Known options, single or multi-select.',
    syntax: '`☐ option`',
  },
  {
    name: 'text',
    detail: 'Free-form human explanation.',
    syntax: '`> ________`',
  },
  {
    name: 'scale',
    detail: 'A numeric position on a bounded range.',
    syntax: '`[scale 0-10]`',
  },
  {
    name: 'matrix',
    detail: 'Shared options across repeated rows.',
    syntax: 'Markdown table with `☐` cells',
  },
]

const links = [
  ['GitHub', 'https://github.com/sunsiyuan/markdown-to-survey'],
  ['npm: @mts/mcp-server', 'https://www.npmjs.com/package/@mts/mcp-server'],
  ['Docs', '/docs'],
  ['OpenAPI', '/api/openapi.json'],
  ['llms.txt', '/llms.txt'],
]

function Surface({
  children,
  className = '',
}: Readonly<{
  children: React.ReactNode
  className?: string
}>) {
  return (
    <section
      className={`rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface)] shadow-[0_28px_90px_-68px_rgba(14,23,38,0.38)] backdrop-blur ${className}`}
    >
      {children}
    </section>
  )
}

function DarkPanel({
  eyebrow,
  title,
  code,
}: Readonly<{
  eyebrow: string
  title: string
  code: string
}>) {
  return (
    <section className="rounded-[1.75rem] border border-slate-900/70 bg-[var(--code-surface)] p-5 shadow-[0_28px_90px_-60px_rgba(8,12,18,0.9)] sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
        {title}
      </h2>
      <pre className="mt-5 overflow-x-auto rounded-[1.35rem] border border-white/8 bg-black/18 p-4 text-[13px] leading-6 text-[var(--accent-fg)] sm:p-5 sm:text-sm sm:leading-7">
        <code>{code}</code>
      </pre>
    </section>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="rounded-[1.35rem] border border-[var(--panel-border)] bg-white/72 px-4 py-3 shadow-[0_18px_55px_-44px_rgba(14,23,38,0.28)] backdrop-blur sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                Markdown to Survey
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/docs"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                Docs
              </Link>
              <a
                href="https://github.com/sunsiyuan/markdown-to-survey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                GitHub
              </a>
            </div>
          </div>
        </header>

        <Surface className="p-5 sm:p-7 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] lg:items-start">
            <div className="max-w-4xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Human input infrastructure for agent workflows
              </p>
              <h1 className="mt-4 max-w-4xl text-[2.9rem] leading-[0.96] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[4rem] lg:text-[5.2rem]">
                Ask humans once. Get structured output back.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">
                MTS handles the narrow but painful step between an agent and a person: publish a
                request, collect responses on a hosted page, then return machine-usable results by
                API or MCP.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="#try-it"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-slate-800"
                >
                  Try in browser
                </a>
                <Link
                  href="/docs"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-900 px-5 py-3 text-sm font-semibold whitespace-nowrap text-slate-950 transition hover:bg-slate-950 hover:text-white"
                >
                  Read docs
                </Link>
                <a
                  href="https://www.npmjs.com/package/@mts/mcp-server"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 py-3 text-sm font-semibold whitespace-nowrap text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  npm: @mts/mcp-server
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ['Canonical input', 'Markdown or schema'],
                  ['Hosted step', 'Human-facing survey page'],
                  ['Structured output', 'JSON the agent can use'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[1.25rem] border border-[var(--panel-border)] bg-white/72 px-4 py-4"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900 sm:text-[15px]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <DarkPanel eyebrow="MCP" title="Install once, call from Claude Code" code={mcpConfigSnippet} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  [
                    'Schema-first when needed',
                    'Agents can skip Markdown parsing entirely and send canonical structure.',
                  ],
                  [
                    'Lifecycle included',
                    'Close, expire, and cap responses without building that state machine yourself.',
                  ],
                ].map(([title, body]) => (
                  <article
                    key={title}
                    className="rounded-[1.35rem] border border-[var(--panel-border)] bg-white/72 p-4"
                  >
                    <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-950">
                      {title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Surface>

        <div className="grid gap-4 lg:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <Surface key={step.title} className="p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Step 0{index + 1}
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                {step.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7">
                {step.body}
              </p>
            </Surface>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Surface className="p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Semantic primitives
            </p>
            <h2 className="mt-3 max-w-xl text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2rem]">
              Keep the contract small. Let the workflow stay readable.
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {primitives.map((primitive) => (
                <article
                  key={primitive.name}
                  className="rounded-[1.25rem] border border-[var(--panel-border)] bg-white/76 p-4"
                >
                  <p className="font-mono text-xs text-[var(--accent-strong)]">{primitive.name}</p>
                  <h3 className="mt-2 text-base font-semibold text-slate-950">{primitive.detail}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{primitive.syntax}</p>
                </article>
              ))}
            </div>
          </Surface>

          <div className="grid gap-5">
            <DarkPanel eyebrow="API" title="Authenticate, create, then fetch results" code={apiFlowSnippet} />
            <Surface className="p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Typical usage
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                MCP stays short because the product surface stays narrow.
              </h2>
              <pre className="mt-5 overflow-x-auto rounded-[1.35rem] border border-[var(--panel-border)] bg-[var(--surface-muted)] p-4 text-[13px] leading-6 text-slate-800 sm:p-5 sm:text-sm sm:leading-7">
                <code>{mcpUsageSnippet}</code>
              </pre>
            </Surface>
          </div>
        </div>

        <TryItPanel />

        <Surface className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Reference
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                Everything public lives behind a small surface area.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {links.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noreferrer' : undefined}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </Surface>
      </div>
    </main>
  )
}
