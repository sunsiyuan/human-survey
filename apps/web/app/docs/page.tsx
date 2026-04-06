import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Docs — Markdown to Survey',
  description:
    'Authentication, Markdown syntax, JSON schema input, API routes, MCP tools, and conditional logic for Markdown to Survey.',
}

const authSnippet = `curl -X POST https://mts.vercel.app/api/keys \\
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

const createSurveySnippet = `curl -X POST https://mts.vercel.app/api/surveys \\
  -H "Authorization: Bearer mts_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "markdown": "# Incident Intake\\n\\n**Q1. Which environment is affected?**\\n\\n- ☐ Local\\n- ☐ Staging\\n- ☐ Production",
    "max_responses": 25,
    "expires_at": "2026-12-31T23:59:59.000Z"
  }'`

const getResultsSnippet = `curl https://mts.vercel.app/api/surveys/svy_123/responses \\
  -H "Authorization: Bearer mts_sk_..." `

const patchSurveySnippet = `curl -X PATCH https://mts.vercel.app/api/surveys/svy_123 \\
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
  markdown: "# Feedback\\n\\n**Q1. Rate onboarding**\\n\\n[scale 1-5]"
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
  ['POST /api/surveys', 'Bearer key', 'Create a survey from Markdown or JSON schema.'],
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
    <pre className="overflow-x-auto rounded-[1.5rem] border border-[var(--panel-border)] bg-slate-950 p-5 text-sm leading-7 text-[var(--accent-fg)]">
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
    <section id={id} className="scroll-mt-24 rounded-[2rem] border border-[var(--panel-border)] bg-white/86 p-7 shadow-[0_24px_80px_-56px_rgba(14,23,38,0.42)] backdrop-blur">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <div className="mt-4 space-y-5 text-slate-700">{children}</div>
    </section>
  )
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--surface)] p-8 shadow-[0_30px_90px_-52px_rgba(14,23,38,0.48)]">
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[var(--accent-strong)]">
            Docs
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            API and protocol reference for AI agents that need human input.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700">
            MTS exposes a minimal authenticated API plus an MCP server. Agents create surveys from
            Markdown or JSON schema, humans answer at a hosted URL, and the agent retrieves
            structured results.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a
              href="/api/openapi.json"
              className="rounded-full bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              OpenAPI JSON
            </a>
            <a
              href="/llms.txt"
              className="rounded-full border border-slate-900 px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white"
            >
              llms.txt
            </a>
            <Link
              href="/"
              className="rounded-full border border-black/10 px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Back to site
            </Link>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="h-fit rounded-[2rem] border border-[var(--panel-border)] bg-white/80 p-5 text-sm shadow-[0_20px_70px_-60px_rgba(14,23,38,0.6)] backdrop-blur lg:sticky lg:top-6">
            <p className="font-semibold uppercase tracking-[0.2em] text-slate-500">Contents</p>
            <nav className="mt-4 space-y-3">
              <a className="block text-slate-700 hover:text-slate-950" href="#authentication">
                Authentication
              </a>
              <a className="block text-slate-700 hover:text-slate-950" href="#markdown-syntax">
                Markdown Syntax
              </a>
              <a className="block text-slate-700 hover:text-slate-950" href="#json-schema">
                JSON Schema Input
              </a>
              <a className="block text-slate-700 hover:text-slate-950" href="#api-reference">
                API Reference
              </a>
              <a className="block text-slate-700 hover:text-slate-950" href="#mcp-tools">
                MCP Tools
              </a>
              <a className="block text-slate-700 hover:text-slate-950" href="#conditional-logic">
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
                If you already have structured survey definitions, send <code>schema</code> instead
                of <code>markdown</code>. The builder validates question types, options, and
                conditional logic references before storing the survey.
              </p>
              <CodeBlock code={schemaSnippet} />
            </Section>

            <Section id="api-reference" title="API Reference">
              <p>
                Machine-readable OpenAPI lives at <a href="/api/openapi.json">/api/openapi.json</a>.
                The table below summarizes the HTTP surface area.
              </p>
              <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--panel-border)]">
                <table className="min-w-full border-collapse bg-white text-left text-sm">
                  <thead className="bg-[var(--surface-muted)] text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Route</th>
                      <th className="px-4 py-3 font-semibold">Auth</th>
                      <th className="px-4 py-3 font-semibold">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiRoutes.map(([route, auth, purpose]) => (
                      <tr key={route} className="border-t border-[var(--panel-border)]">
                        <td className="px-4 py-3 font-mono text-xs text-slate-950">{route}</td>
                        <td className="px-4 py-3 text-slate-600">{auth}</td>
                        <td className="px-4 py-3 text-slate-700">{purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--panel-border)]">
                <table className="min-w-full border-collapse bg-white text-left text-sm">
                  <thead className="bg-[var(--surface-muted)] text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Tool</th>
                      <th className="px-4 py-3 font-semibold">What it does</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mcpTools.map(([tool, purpose]) => (
                      <tr key={tool} className="border-t border-[var(--panel-border)]">
                        <td className="px-4 py-3 font-mono text-xs text-slate-950">{tool}</td>
                        <td className="px-4 py-3 text-slate-700">{purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
