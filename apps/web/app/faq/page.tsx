import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ — HumanSurvey',
  description:
    'How to have your AI run a survey for your community, customers, or attendees — plus how HumanSurvey compares to Typeform, Google Forms, and SurveyMonkey when the consumer is an agent.',
  alternates: {
    canonical: '/faq',
    types: { 'text/markdown': '/faq.md' },
  },
}

type Faq = {
  q: string
  a: string
}

const faqs: Faq[] = [
  {
    q: 'Can Claude (or another AI) actually send a survey to my community for me?',
    a: "Yes. With HumanSurvey connected as an MCP server, you tell Claude what you want to learn — it generates the survey schema, creates the survey, and returns a /s/{id} share link. Distribution is up to you or your agent: you paste the link into Discord / Slack / an email, or ask your agent to post it if it has a Slack/Discord/email tool connected. HumanSurvey doesn't email-blast on your behalf — we don't have your audience list, and narrow scope is a feature.",
  },
  {
    q: 'How is this different from Typeform, Google Forms, or SurveyMonkey?',
    a: "Those tools assume a human builds the form in a UI, shares the link, then reads responses in a dashboard. HumanSurvey flips it: an AI writes the schema programmatically, and an AI consumes the results programmatically. The hosted form is intentionally minimal. If a product manager is going to eyeball responses by hand, reach for Typeform. If an AI is going to synthesize them and do the next thing, reach for HumanSurvey.",
  },
  {
    q: 'Do I need to write code or JSON to create a survey?',
    a: "No. You describe what you want to learn in plain language to your AI (\"ask attendees to rate the session 1–5, what topics they want next, any one thing to change\"). The AI generates the JSON schema and posts it via MCP or REST. You never see the schema unless you want to.",
  },
  {
    q: 'How do the results come back to my AI?',
    a: 'Your agent calls the `get_results` MCP tool (or `GET /api/surveys/{id}/responses` over REST) and gets aggregated counts plus raw JSON responses. From there it can draft a retro, update roadmap issues, send a Slack summary, or do anything else — because the output is structured data, not a PDF.',
  },
  {
    q: 'Are responses anonymous?',
    a: 'By default, yes. The respondent page does not collect names, emails, or IDs — only the answers to the questions you defined. If you want to tie a response to a person, include an explicit question for it (e.g., "Your email") in the schema.',
  },
  {
    q: 'Can I close a survey after a deadline or a response cap?',
    a: 'Yes. Pass `expires_at` (ISO timestamp) and/or `max_responses` when creating the survey. Your agent can also close it anytime by calling `close_survey`. Once closed, the public page shows a closed state and rejects new submissions.',
  },
  {
    q: 'Which AI tools / agent frameworks work with HumanSurvey?',
    a: "Anything that speaks MCP — Claude Code, Claude Desktop, Cursor, Cline, and other MCP-compatible clients — can use the MCP server directly with one config block. Anything else (custom agents, scripts, backend jobs) can call the REST API with a bearer token.",
  },
  {
    q: 'Can I customize the look of the hosted form?',
    a: "Not today. The form is intentionally minimal and consistent across surveys. We're tracking completion-rate data first to see whether theming would actually move the needle — if it does, we'll add agent-facing theme presets, not an HTML/CSS plugin surface.",
  },
  {
    q: 'What question types are supported?',
    a: '`single_choice`, `multi_choice`, `text`, `scale`, and `matrix`, plus conditional `showIf` logic. The vocabulary is intentionally small so an AI can reliably generate valid schemas, rather than giving a human designer every possible knob.',
  },
  {
    q: 'Is it free?',
    a: 'Open source, currently free to use for reasonable volumes. Long-term, billing will be tied to the owner email / wallet address captured at API key creation time. No surprise invoices — when pricing lands, it will be announced up front.',
  },
  {
    q: 'Where do I point my AI for complete technical details?',
    a: 'The human docs are at /docs. Machine-readable references: /api/openapi.json (OpenAPI 3), /llms.txt (short AI-first overview), /llms-full.txt (full AI-readable index).',
  },
]

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.a,
    },
  })),
}

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
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
              href="/docs"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Docs
            </Link>
          </div>
        </header>

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            FAQ
          </p>
          <h1 className="text-4xl font-normal tracking-[-0.015em] text-slate-950 sm:text-5xl">
            How it works when your AI runs the survey.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            Short answers to what community managers, brand teams, indie makers,
            and developers ask before connecting HumanSurvey to their agent.
          </p>
        </section>

        <section className="space-y-3">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-4 backdrop-blur-sm"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium leading-6 text-slate-900 [&::-webkit-details-marker]:hidden">
                <span>{f.q}</span>
                <span className="mt-1 shrink-0 font-mono text-xs text-[var(--accent)] transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-[1.7] text-slate-800">
                {f.a}
              </p>
            </details>
          ))}
        </section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Still have questions?
          </p>
          <p className="text-sm leading-6 text-slate-700">
            Open an issue on{' '}
            <a
              href="https://github.com/sunsiyuan/human-survey/issues"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-slate-950"
            >
              GitHub
            </a>{' '}
            or read the{' '}
            <Link href="/docs" className="underline underline-offset-2 hover:text-slate-950">
              full docs
            </Link>
            .
          </p>
          <p className="text-sm leading-6 text-slate-700">
            <a
              href="/faq.md"
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
