import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Community feedback with AI — HumanSurvey use case',
  description:
    'How community and brand managers collect structured feedback from members after an AMA, drop, or campaign by telling Claude (or any agent) what they want to learn — no Typeform, no chasing responses, no pivot tables.',
  alternates: { canonical: '/use-cases/community-feedback' },
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Community feedback with AI: replacing the Typeform + chase loop',
  description:
    'A worked walkthrough of using HumanSurvey and Claude to run a feedback loop for a community after an AMA or product drop.',
  datePublished: '2026-04-20',
  dateModified: '2026-04-20',
  author: { '@type': 'Organization', name: 'HumanSurvey' },
  publisher: { '@type': 'Organization', name: 'HumanSurvey' },
  mainEntityOfPage: 'https://www.humansurvey.co/use-cases/community-feedback',
}

export default function CommunityFeedbackPage() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
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
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Docs
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Use case · Community / brand managers
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Community feedback, the AI-native way.
          </h1>
          <p className="text-base leading-7 text-slate-700">
            If you run a Discord, Telegram, or Slack community — or a brand
            audience on any channel — you already know the ritual. Something
            happens (an AMA, a drop, a campaign, a controversial proposal). You
            want to know what your members thought. You open Typeform, rebuild a
            rating form from scratch, share the link, nag people, wait a week,
            and eventually paste responses into a spreadsheet to spot the
            themes.{' '}
            <strong className="font-semibold text-slate-900">
              This page is about replacing that entire loop with a single
              sentence to your AI.
            </strong>
          </p>
        </section>

        <Section tag="The old way">
          <p>
            Run a Typeform / Google Forms / SurveyMonkey form. Build the
            questions in a visual editor. Copy the link. Drop it in{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              #general
            </code>
            . Ping people again 48 hours later. Export the CSV. Skim 180 rows.
            Write a post summarizing what you read. Lose half the nuance because
            you were tired. The form itself takes 20 minutes; the&nbsp;synthesis
            takes an hour; the chasing takes days.
          </p>
          <p>
            This worked when the best tool for collecting structured input from
            a group was a hosted form with a dashboard. It is no longer the best
            tool — not because forms are broken, but because the{' '}
            <em>consumer of the responses</em> has changed. If an AI is going to
            read the results and do the next thing, the form doesn&apos;t need a
            dashboard. It needs an API.
          </p>
        </Section>

        <Section tag="The new loop">
          <p>
            HumanSurvey is a minimal, hosted form plus an MCP server and a REST
            API. Your agent — Claude, Cursor, or anything that speaks MCP — does
            three things on your behalf:
          </p>
          <Ordered
            items={[
              'Designs the survey from your plain-language request. No form builder, no JSON.',
              'Creates the survey and hands you a /s/{id} share URL. You paste it in your community channel (or ask your agent to post it if it has a Slack/Discord tool).',
              'Reads the responses and synthesizes them for you, on demand. "What did people think?" becomes a real question with a real structured answer.',
            ]}
          />
          <p>
            HumanSurvey itself never contacts your audience. It returns you a
            link; distribution is your job or your agent&apos;s job. That&apos;s
            deliberate — the audience list belongs to you, not to this service.
          </p>
        </Section>

        <Section tag="Worked example — post-AMA feedback">
          <p>
            You just wrapped a Friday AMA with a guest speaker in a Discord
            server of ~400 members. Saturday morning, you open Claude Code with
            the HumanSurvey MCP installed and say:
          </p>

          <Quote>
            &ldquo;Run a post-AMA feedback survey for Friday&apos;s session.
            I want a 1–5 rating for the session overall, one question asking
            what topics they want us to cover next, and an open text asking what
            we should change. Keep it under 2 minutes.&rdquo;
          </Quote>

          <p>Claude generates something like:</p>

          <CodeBlock>{`{
  "title": "Friday AMA — your feedback",
  "description": "Under 2 minutes. Helps us plan the next one.",
  "sections": [{
    "questions": [
      { "type": "scale", "label": "Rate the session", "min": 1, "max": 5,
        "minLabel": "Poor", "maxLabel": "Excellent" },
      { "type": "multi_choice", "label": "Topics you want next?",
        "options": [
          { "label": "Infra scaling" },
          { "label": "Pricing models" },
          { "label": "Hiring your first engineer" },
          { "label": "Fundraising" },
          { "label": "Product-market fit" }
        ]
      },
      { "type": "text", "label": "One thing we should change next time?" }
    ]
  }],
  "max_responses": 500,
  "expires_at": "2026-04-23T23:59:00Z"
}`}</CodeBlock>

          <p>
            Claude calls{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              create_survey
            </code>{' '}
            and returns:
          </p>

          <CodeBlock>{`Survey created.
Respondent URL: https://www.humansurvey.co/s/abc123
3 questions · expires in 72 hours · max 500 responses`}</CodeBlock>

          <p>
            You paste the URL into your{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              #ama-recap
            </code>{' '}
            channel. 184 people click it over the next two days. Tuesday
            morning, you ask Claude:
          </p>

          <Quote>&ldquo;How did the AMA land?&rdquo;</Quote>

          <p>Claude calls{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              get_results
            </code>{' '}
            and returns a synthesis grounded in the actual JSON:
          </p>

          <CodeBlock>{`184 responses (46% of active members).
Average rating: 4.3 / 5.
Top requested next topic: "Infra scaling" (60% — clear lead).
Runner-up: "Hiring your first engineer" (31%).
Common theme in open text: "too many mid-session interruptions"
  — 34 responses mention it. A few want the guest to answer
  submitted questions earlier rather than taking live ones.

Suggested next move: schedule an infra-scaling AMA and adopt a
"collected questions first, live Q&A at the end" format.`}</CodeBlock>

          <p>
            That synthesis came from machine-readable JSON, not a human
            squinting at a dashboard. Total operator time: about 90 seconds of
            typing, spread across two mornings.
          </p>
        </Section>

        <Section tag="Other community scenarios that fit the same loop">
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  Campaign / drop reactions.
                </strong>{' '}
                After a merch drop or a limited edition release, collect 3–5
                targeted questions about pricing perception, product details,
                and follow-up buying intent.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Community pulse.
                </strong>{' '}
                Monthly NPS-style check-in, with a conditional text field that
                only appears if the score is ≤ 6. Your agent flags dissatisfied
                members for you to follow up with directly.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Policy vote.
                </strong>{' '}
                Proposing a new community rule? Collect approve/reject + reasons
                in 72 hours. Your agent can be told{' '}
                <em>&quot;only publish the announcement if approval &gt; 70%&quot;</em>
                .
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Event retro.
                </strong>{' '}
                After a meetup or conference, rate sessions in a matrix and
                capture what to do differently — your agent writes the public
                retro post for you.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Creator-economy feedback.
                </strong>{' '}
                Podcasters and newsletter operators collect structured reactions
                to episodes or issues without leaving their workflow.
              </>,
            ]}
          />
        </Section>

        <Section tag="How this compares">
          <p>
            HumanSurvey is not trying to be a better Typeform. It&apos;s a
            different product category: feedback infrastructure for when the
            consumer of the results is an AI, not a PM.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--panel-border)] text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4 py-3 font-semibold">Tool</th>
                  <th className="px-4 py-3 font-semibold">Build the form</th>
                  <th className="px-4 py-3 font-semibold">Read the results</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">Typeform</td>
                  <td className="px-4 py-3">Human, in a visual builder</td>
                  <td className="px-4 py-3">Human, in a dashboard</td>
                </tr>
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">Google Forms</td>
                  <td className="px-4 py-3">Human, in a visual builder</td>
                  <td className="px-4 py-3">Human, in Sheets</td>
                </tr>
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">Discord poll</td>
                  <td className="px-4 py-3">Human, slash command</td>
                  <td className="px-4 py-3">Human, in chat (yes/no only)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">HumanSurvey</td>
                  <td className="px-4 py-3">Agent, from plain language</td>
                  <td className="px-4 py-3">Agent, structured JSON</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            If a PM is going to read the responses by eye, use Typeform — its
            form design is better and the dashboard is polished. If you just
            need a one-off free form and have no AI in your workflow, Google
            Forms is fine. HumanSurvey is the right pick when an agent is
            already in your loop and you want the results to flow straight into
            its context.
          </p>
        </Section>

        <Section tag="Getting started in two steps">
          <Ordered
            items={[
              <>
                Add HumanSurvey as an MCP server in Claude Code (
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  ~/.claude.json
                </code>
                ). See the{' '}
                <Link href="/docs" className="underline underline-offset-2">
                  full config snippet in the docs
                </Link>
                .
              </>,
              <>
                Ask Claude for an API key:{' '}
                <em>&quot;create an API key for HumanSurvey.&quot;</em> It
                calls{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  create_key
                </code>{' '}
                and stores the result. You&apos;re done — next time you want
                to collect feedback, just tell Claude what you want to learn.
              </>,
            ]}
          />
        </Section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            More
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              ·{' '}
              <Link href="/faq" className="underline underline-offset-2 hover:text-slate-950">
                FAQ
              </Link>{' '}
              — anonymity, distribution, pricing, agent compatibility
            </li>
            <li>
              ·{' '}
              <Link href="/docs" className="underline underline-offset-2 hover:text-slate-950">
                Docs
              </Link>{' '}
              — JSON schema, MCP tools, conditional logic
            </li>
            <li>
              ·{' '}
              <Link href="/use-cases" className="underline underline-offset-2 hover:text-slate-950">
                Other use cases
              </Link>{' '}
              — product launches, events
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}

function Section({
  tag,
  children,
}: {
  tag: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
        {tag}
      </p>
      <div className="space-y-4 text-[15px] leading-7 text-slate-700">{children}</div>
    </section>
  )
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="rounded-2xl border-l-4 border-[var(--accent)] bg-[var(--surface)] px-5 py-4 text-[15px] italic leading-7 text-slate-800">
      {children}
    </blockquote>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--code-surface)] px-4 py-4 font-mono text-[12px] leading-5 text-[var(--accent-fg)]">
      {children}
    </pre>
  )
}

function Ordered({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-[2px] shrink-0 font-mono text-[11px] text-[var(--accent)]">
            0{i + 1}
          </span>
          <span className="text-slate-700">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Unordered({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
          <span className="text-slate-700">{item}</span>
        </li>
      ))}
    </ul>
  )
}
