import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Docs — Markdown to Survey',
  description:
    'Authentication, JSON schema input, API routes, MCP tools, and conditional logic for Markdown to Survey.',
}

const authSnippet = `curl -X POST https://ask-human.vercel.app/api/keys \\
  -H "Content-Type: application/json" \\
  -d '{"name":"triage-agent"}'`

const markdownChoiceSnippet = `**Q1. Which environment are you debugging?**

- ☐ Local
- ☐ Staging
- ☐ Production`

const markdownTextSnippet = `**Q2. What happened right before the error?**

> _______________________________________________`

const markdownScaleSnippet = `**Q3. How urgent is this issue?**

[scale 1-5 min-label="Low" max-label="Critical"]`

const markdownMatrixSnippet = `| # | Workflow Step | Status |
|---|---------------|--------|
| 1 | Install       | ☐Good ☐OK ☐Bad |
| 2 | Login         | ☐Good ☐OK ☐Bad |
| 3 | Reporting     | ☐Good ☐OK ☐Bad |`

const conditionalSnippet = `**Q1. Did the deploy finish?**

- ☐ Yes
- ☐ No

**Q2. Which step failed?**

> show if: Q1 = "No"

> _______________________________________________`

const schemaSnippet = `{
  "schema": {
    "title": "Incident Intake",
    "description": "Collect the missing facts before the agent responds.",
    "sections": [
      {
        "title": "Context",
        "questions": [
          {
            "type": "single_choice",
            "label": "Which environment is affected?",
            "required": true,
            "options": [
              { "label": "Local" },
              { "label": "Staging" },
              { "label": "Production" }
            ]
          },
          {
            "type": "scale",
            "label": "How urgent is this issue?",
            "required": true,
            "min": 1,
            "max": 5,
            "minLabel": "Low",
            "maxLabel": "Critical"
          }
        ]
      }
    ]
  }
}`

const createSurveySnippet = `curl -X POST https://ask-human.vercel.app/api/surveys \\
  -H "Authorization: Bearer mts_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "schema": {
      "title": "Incident Intake",
      "sections": [{
        "questions": [
          {
            "type": "single_choice",
            "label": "Which environment is affected?",
            "required": true,
            "options": [
              { "label": "Local" },
              { "label": "Staging" },
              { "label": "Production" }
            ]
          }
        ]
      }]
    },
    "max_responses": 25,
    "expires_at": "2026-12-31T23:59:59.000Z"
  }'`

const getResultsSnippet = `curl https://ask-human.vercel.app/api/surveys/svy_123/responses \\
  -H "Authorization: Bearer mts_sk_..." `

const patchSurveySnippet = `curl -X PATCH https://ask-human.vercel.app/api/surveys/svy_123 \\
  -H "Authorization: Bearer mts_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"status":"closed"}'`

const mcpConfigSnippet = `{
  "mcpServers": {
    "survey": {
      "command": "npx",
      "args": ["-y", "@mts/mcp-server"],
      "env": { "MTS_API_KEY": "mts_sk_your_key_here" }
    }
  }
}`

const mcpUsageSnippet = `create_survey({
  schema: {
    title: "Incident Intake",
    sections: [{
      questions: [
        { type: "single_choice", label: "Which environment?", required: true,
          options: [{ label: "Local" }, { label: "Staging" }, { label: "Production" }] },
        { type: "scale", label: "How urgent?", required: true, min: 1, max: 5,
          minLabel: "Low", maxLabel: "Critical" }
      ]
    }]
  }
})

get_results({
  survey_id: "svy_123"
})

close_survey({
  survey_id: "svy_123"
})`

const apiRoutes = [
  ['POST /api/keys', 'Public', 'Create a new API key and return the raw secret once.'],
  ['GET /api/keys', 'Bearer key', 'List metadata for the current key.'],
  ['DELETE /api/keys/{id}', 'Bearer key', 'Revoke the current API key.'],
  ['POST /api/surveys', 'Bearer key', 'Create a survey from JSON schema.'],
  ['GET /api/surveys', 'Bearer key', 'List surveys owned by the current key.'],
  ['GET /api/surveys/{id}', 'Public', 'Return survey metadata, schema, and lifecycle fields.'],
  ['PATCH /api/surveys/{id}', 'Bearer key', 'Update status, max_responses, or expires_at.'],
  ['POST /api/surveys/{id}/responses', 'Public', 'Submit a response payload.'],
  ['GET /api/surveys/{id}/responses', 'Bearer key', 'Return aggregated question results and raw submissions.'],
]

const mcpTools = [
  ['create_survey', 'Create a survey from Markdown or JSON schema and return the respondent URL.'],
  ['get_results', 'Fetch structured results for a survey by survey_id.'],
  ['list_surveys', 'List surveys owned by the configured API key.'],
  ['close_survey', 'Close an open survey so it stops collecting responses.'],
]

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-[1.25rem] border border-[var(--panel-border)] bg-slate-950 p-4 text-[13px] leading-6 text-[var(--accent-fg)] sm:p-5 sm:text-sm sm:leading-7">
      <code>{code}</code>
    </pre>
  )
}

function Section({
  id,
  title,
  children,
}: Readonly<{
  id: string
  title: string
  children: React.ReactNode
}>) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface)] p-5 shadow-[0_28px_90px_-68px_rgba(14,23,38,0.38)] backdrop-blur sm:p-7">
      <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-5 text-slate-700">{children}</div>
    </section>
  )
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface)] p-6 shadow-[0_28px_90px_-68px_rgba(14,23,38,0.38)] sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Docs
          </p>
          <h1 className="mt-4 max-w-4xl text-3xl leading-tight font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl">
            API and protocol reference for AI agents that need human input.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">
            MTS exposes a minimal authenticated API plus an MCP server. Agents create surveys from
            JSON schema, humans answer at a hosted URL, and the agent retrieves
            structured results.
          </p>
          <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap">
            <a
              href="/api/openapi.json"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-3 font-semibold whitespace-nowrap text-white transition hover:bg-slate-800"
            >
              OpenAPI JSON
            </a>
            <a
              href="/llms.txt"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-900 px-5 py-3 font-semibold whitespace-nowrap text-slate-950 transition hover:bg-slate-950 hover:text-white"
            >
              llms.txt
            </a>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 py-3 font-semibold whitespace-nowrap text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Back to site
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
          <aside className="h-fit rounded-[1.5rem] border border-[var(--panel-border)] bg-white/80 p-4 text-sm shadow-[0_20px_70px_-60px_rgba(14,23,38,0.36)] backdrop-blur sm:p-5 lg:sticky lg:top-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Contents</p>
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-3">
              <a className="rounded-full border border-[var(--panel-border)] px-3 py-2 whitespace-nowrap text-slate-700 hover:border-slate-900 hover:text-slate-950 lg:block lg:rounded-none lg:border-0 lg:px-0 lg:py-0" href="#authentication">
                Authentication
              </a>
              <a className="rounded-full border border-[var(--panel-border)] px-3 py-2 whitespace-nowrap text-slate-700 hover:border-slate-900 hover:text-slate-950 lg:block lg:rounded-none lg:border-0 lg:px-0 lg:py-0" href="#markdown-syntax">
                Markdown Syntax
              </a>
              <a className="rounded-full border border-[var(--panel-border)] px-3 py-2 whitespace-nowrap text-slate-700 hover:border-slate-900 hover:text-slate-950 lg:block lg:rounded-none lg:border-0 lg:px-0 lg:py-0" href="#json-schema">
                JSON Schema Input
              </a>
              <a className="rounded-full border border-[var(--panel-border)] px-3 py-2 whitespace-nowrap text-slate-700 hover:border-slate-900 hover:text-slate-950 lg:block lg:rounded-none lg:border-0 lg:px-0 lg:py-0" href="#api-reference">
                API Reference
              </a>
              <a className="rounded-full border border-[var(--panel-border)] px-3 py-2 whitespace-nowrap text-slate-700 hover:border-slate-900 hover:text-slate-950 lg:block lg:rounded-none lg:border-0 lg:px-0 lg:py-0" href="#mcp-tools">
                MCP Tools
              </a>
              <a className="rounded-full border border-[var(--panel-border)] px-3 py-2 whitespace-nowrap text-slate-700 hover:border-slate-900 hover:text-slate-950 lg:block lg:rounded-none lg:border-0 lg:px-0 lg:py-0" href="#conditional-logic">
                Conditional Logic
              </a>
            </nav>
          </aside>

          <div className="space-y-8">
            <Section id="authentication" title="Authentication">
              <p>
                Creator routes use bearer authentication with keys shaped like <code>mts_sk_...</code>.
                The raw key is only returned once when you call <code>POST /api/keys</code>.
              </p>
              <CodeBlock code={authSnippet} />
              <p>
                Pass the key on authenticated requests:
                <code className="ml-2">Authorization: Bearer mts_sk_...</code>
              </p>
            </Section>

            <Section id="markdown-syntax" title="Markdown Syntax">
              <p>
                MTS has four semantic question types: choice, text, scale, and matrix. The parser
                turns them into a normalized survey schema.
              </p>
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Choice</h3>
                  <CodeBlock code={markdownChoiceSnippet} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Text</h3>
                  <CodeBlock code={markdownTextSnippet} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Scale</h3>
                  <CodeBlock code={markdownScaleSnippet} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Matrix</h3>
                  <CodeBlock code={markdownMatrixSnippet} />
                </div>
              </div>
            </Section>

            <Section id="json-schema" title="JSON Schema Input">
              <p>
                The API accepts <code>schema</code> as the canonical input format. Send a{' '}
                <code>SurveyInput</code> object — the server validates question types, options, and
                conditional logic before storing the survey.
              </p>
              <CodeBlock code={schemaSnippet} />
              <p>
                The web demo lets you write plain text or Markdown and uses an LLM to translate it
                into schema before submitting — this mirrors what your agent would do.
              </p>
            </Section>

            <Section id="api-reference" title="API Reference">
              <p>
                Machine-readable OpenAPI lives at <a href="/api/openapi.json">/api/openapi.json</a>.
                The cards below summarize the HTTP surface area.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {apiRoutes.map(([route, auth, purpose]) => (
                  <article
                    key={route}
                    className="rounded-[1.25rem] border border-[var(--panel-border)] bg-white p-4"
                  >
                    <p className="font-mono text-xs text-[var(--accent-strong)]">{route}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{auth}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{purpose}</p>
                  </article>
                ))}
              </div>
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Create survey</h3>
                  <CodeBlock code={createSurveySnippet} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Get results</h3>
                  <CodeBlock code={getResultsSnippet} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Close survey</h3>
                  <CodeBlock code={patchSurveySnippet} />
                </div>
              </div>
            </Section>

            <Section id="mcp-tools" title="MCP Tools">
              <p>
                Claude Code and other MCP clients can call MTS directly through
                <code className="ml-2">@mts/mcp-server</code>.
              </p>
              <CodeBlock code={mcpConfigSnippet} />
              <div className="grid gap-3 sm:grid-cols-2">
                {mcpTools.map(([tool, purpose]) => (
                  <article
                    key={tool}
                    className="rounded-[1.25rem] border border-[var(--panel-border)] bg-white p-4"
                  >
                    <p className="font-mono text-xs text-[var(--accent-strong)]">{tool}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{purpose}</p>
                  </article>
                ))}
              </div>
              <CodeBlock code={mcpUsageSnippet} />
            </Section>

            <Section id="conditional-logic" title="Conditional Logic">
              <p>
                Use <code>show if:</code> blocks in Markdown or <code>showIf</code> in JSON schema
                to reveal follow-up questions only when the condition matches.
              </p>
              <CodeBlock code={conditionalSnippet} />
              <p>Supported operators map to semantic checks:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <code>=</code> or <code>eq</code> for equality
                </li>
                <li>
                  <code>!=</code> or <code>neq</code> for inequality
                </li>
                <li>
                  <code>contains</code> for multi-select membership
                </li>
                <li>
                  <code>answered</code> to check whether the earlier question has any answer
                </li>
              </ul>
            </Section>
          </div>
        </div>
      </div>
    </main>
  )
}
