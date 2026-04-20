import type { Metadata } from 'next'
import Link from 'next/link'

import {
  CodeBlock,
  Ordered,
  Quote,
  Section,
  Unordered,
} from '@/components/use-cases/primitives'

export const metadata: Metadata = {
  title: 'Event feedback with AI — HumanSurvey use case',
  description:
    'How conference and meetup organizers collect session ratings, speaker feedback, and retro input by telling Claude (or any agent) what to learn — matrix questions, open text, and grounded retro synthesis.',
  alternates: {
    canonical: '/use-cases/events',
    types: { 'text/markdown': '/use-cases/events.md' },
  },
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Event feedback with AI: session ratings and retros, agent-driven',
  description:
    'A worked walkthrough of using HumanSurvey and Claude to collect post-event feedback from conference, meetup, and webinar attendees.',
  datePublished: '2026-04-20',
  dateModified: '2026-04-20',
  author: { '@type': 'Organization', name: 'HumanSurvey' },
  publisher: { '@type': 'Organization', name: 'HumanSurvey' },
  mainEntityOfPage: 'https://www.humansurvey.co/use-cases/events',
}

export default function EventsPage() {
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
              className="hidden min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 sm:inline-flex"
            >
              Docs
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Use case · Event organizers
          </p>
          <h1 className="text-4xl font-normal tracking-[-0.015em] text-slate-950 sm:text-5xl">
            Event feedback, the AI-native way.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            You just ran a conference, a meetup, or a webinar. Now comes the
            part everyone dreads: getting structured feedback from attendees
            while it&apos;s still fresh, writing a retro your speakers and
            sponsors can actually read, and deciding what to change for next
            time.{' '}
            <strong className="font-semibold text-slate-900">
              This page is about making your AI agent run that whole loop —
              session ratings, open text, speaker-specific feedback, and a
              grounded synthesis — before the attendees log off for the day.
            </strong>
          </p>
        </section>

        <Section tag="The old way">
          <p>
            Rebuild a post-event Typeform, one row per session in a matrix
            question. Export the attendee list from Eventbrite or Luma. Send
            them the link with a generic &ldquo;we&apos;d love your
            feedback&rdquo; subject line. 22% respond. Export the CSV. Open
            Sheets. Sort by session. Paste open-text responses into a doc and
            try to summarize. Tell the keynote speaker &ldquo;people loved
            it&rdquo; and the workshop host &ldquo;there were some
            comments&rdquo; based on vibes. Send a retro Slack message three
            days later that half the org skims.
          </p>
          <p>
            None of that is broken — it&apos;s just slow, and it leaves a
            mountain of nuance on the cutting-room floor. The synthesis step is
            the one that actually matters for deciding what to change next
            time, and it&apos;s the step a human is least good at when tired on
            a Sunday evening.
          </p>
        </Section>

        <Section tag="The new loop">
          <p>
            HumanSurvey is a small hosted-form service fronted by an MCP server
            and a REST API. Your agent — Claude Code, Claude Desktop, Cursor,
            any MCP client — takes on three jobs:
          </p>
          <Ordered
            items={[
              'Designs the schema from your intent: per-session matrix ratings, an overall NPS, open text, and whatever speaker-specific or sponsor-specific questions you want.',
              'Creates the survey and returns /s/{id}. You drop the link in the event Slack, Discord, or the day-of attendee email. Or ask your agent to post to the channel if it has that tool.',
              'Reads the results and synthesizes — by session, by track, by speaker, by sponsor — into whatever format you need (retro doc, per-speaker email drafts, sponsor-facing PDF).',
            ]}
          />
          <p>
            The whole point is that an organizer (often a volunteer or a very
            tired full-timer) doesn&apos;t spend Sunday night pivoting a
            spreadsheet. The agent does the reading. You review the output.
          </p>
        </Section>

        <Section tag="Worked example — post-conference retro">
          <p>
            You organized a two-day developer conference. Four tracks, 22
            sessions, 380 attendees. Monday morning, you open Claude Code with
            HumanSurvey installed and say:
          </p>

          <Quote>
            &ldquo;Run our post-conference feedback survey. Matrix: for each of
            these 22 sessions, 1–5 rating and would-recommend yes/no. Overall
            NPS for the whole conference. Open text: what should we change next
            year? Multi-choice: which tracks do you want more of? Keep it 4
            minutes max, expires Friday.&rdquo;
          </Quote>

          <p>
            You paste in the session list from the event page. Claude
            generates the schema — the matrix question is the one organizers
            always write badly by hand, and the agent gets the row/column
            shape right on the first try:
          </p>

          <CodeBlock>{`{
  "title": "DevConf 2026 — your feedback",
  "description": "4 minutes. Helps us plan DevConf 2027.",
  "sections": [{
    "questions": [
      { "type": "matrix",
        "label": "Rate each session you attended (1–5; skip if you didn't go)",
        "rows": [
          "Keynote — What's next for open-source databases",
          "Track A: Building an agent-native backend",
          "Track A: Workshop — MCP server basics",
          "Track B: From prototype to 10M requests/day",
          "Track C: Fireside — the future of serverless"
          /* … 17 more rows … */
        ],
        "columns": ["1", "2", "3", "4", "5", "N/A"]
      },
      { "type": "scale",
        "label": "How likely are you to recommend DevConf to a colleague?",
        "min": 0, "max": 10,
        "minLabel": "Not at all", "maxLabel": "Definitely" },
      { "type": "multi_choice",
        "label": "Which tracks do you want more of next year?",
        "options": [
          { "label": "Databases & storage" },
          { "label": "Agent infrastructure" },
          { "label": "Scaling & performance" },
          { "label": "Developer experience" },
          { "label": "Security" }
        ]
      },
      { "type": "text", "label": "One thing we should change next year?" }
    ]
  }],
  "max_responses": 500,
  "expires_at": "2026-04-24T23:59:00Z"
}`}</CodeBlock>

          <p>
            Claude calls{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              create_survey
            </code>{' '}
            and returns <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">https://www.humansurvey.co/s/evt445</code>.
            You drop it into the post-event attendee email and pin it in the
            #general Slack channel. By Thursday, 241 responses are in. You ask
            Claude:
          </p>

          <Quote>&ldquo;Summarize DevConf feedback, grouped by track. Include what to change.&rdquo;</Quote>

          <p>
            Claude calls{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              get_results
            </code>{' '}
            and returns:
          </p>

          <CodeBlock>{`241 responses (63%). NPS: 56 (strong).

Top-rated sessions:
  1. Keynote — Open-source databases  (4.7 / 5, 92% recommend)
  2. Track B workshop — 10M req/day   (4.6 / 5, 88% recommend)
  3. Fireside — future of serverless  (4.5 / 5, 85% recommend)

Bottom-rated sessions:
  1. Track A: MCP server basics       (3.1 / 5, 41% recommend)
     → open text theme: "too basic, expected deeper content"
  2. Track C: Security panel          (3.3 / 5, 48% recommend)
     → open text theme: "panelists talked past each other"

Track demand for next year:
  1. Agent infrastructure (71%)  ← clear #1, up from 52% last year
  2. Scaling & performance (54%)
  3. Developer experience (48%)
  4. Databases & storage (33%)
  5. Security (22%)

Top "what to change" themes (from 188 open-text responses):
  1. Longer breaks between sessions (47 mentions)
  2. Food queue was too slow on Day 2 (31 mentions)
  3. Track A needs advanced content, not intro talks (24 mentions)
  4. More ad-hoc unconference space (18 mentions)

Suggested moves for DevConf 2027:
  1. Double the agent-infra track — demand has shifted there.
  2. Rework Track A content design — split beginner vs advanced.
  3. Extend between-session breaks to 20 min (currently 10).
  4. Fix food logistics on Day 2 — separate queue or staggered lunch.
  5. Send per-speaker feedback packets (Claude can draft these).`}</CodeBlock>

          <p>
            Then you ask Claude to draft per-speaker emails with the relevant
            slice of the data, which it does grounded in the raw JSON — each
            speaker gets their own rating, their own open-text comments, and
            nothing about the other 21 sessions.
          </p>
        </Section>

        <Section tag="Other event scenarios that fit the same loop">
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  Pre-event expectation survey.
                </strong>{' '}
                Two weeks before the event, ask registered attendees what
                they&apos;re hoping to get out of it. Your agent cross-checks
                against the agenda and flags mismatches so you can adjust
                session framing or prep speakers.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Mid-event daily pulse.
                </strong>{' '}
                For multi-day conferences, send a short end-of-Day-1 survey. If
                something&apos;s going wrong (food, AV, pacing), you find out
                in time to fix Day 2 — not in the retro three weeks later.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Sponsor feedback.
                </strong>{' '}
                Post-event, ask sponsors about booth traffic quality, lead
                capture, and whether they&apos;d sponsor again. Your agent
                drafts a sponsor-facing retro PDF grounded in their own
                responses plus overall attendee metrics.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Speaker self-reflection.
                </strong>{' '}
                A private survey sent to speakers only — what worked, what
                they&apos;d change about their slot, venue/AV issues. Keeps
                institutional knowledge in a machine-readable form for next
                year&apos;s program committee.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Meetup / community retro.
                </strong>{' '}
                Smaller, faster cadence. 3 questions, closes in 48 hours, your
                agent reads the results and updates the next month&apos;s
                meetup agenda proposal automatically.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Webinar / online workshop feedback.
                </strong>{' '}
                Triggered at the end of the Zoom/Meet session. Quick NPS, one
                ranking question on which follow-up topic people want, one
                open text. Your agent compiles the list and feeds it into your
                next-session planning.
              </>,
            ]}
          />
        </Section>

        <Section tag="How this compares">
          <p>
            Event feedback tools fall into three rough shapes — platforms with
            bundled surveying, general form builders, and agent-native
            infrastructure. Pick based on who is going to consume the output:
          </p>

          <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--panel-border)] text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4 py-3 font-semibold">Tool</th>
                  <th className="px-4 py-3 font-semibold">Build</th>
                  <th className="px-4 py-3 font-semibold">Read</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">Sched / Whova</td>
                  <td className="px-4 py-3">Human, in the event platform</td>
                  <td className="px-4 py-3">Human, platform dashboard</td>
                </tr>
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">Typeform</td>
                  <td className="px-4 py-3">Human, visual builder</td>
                  <td className="px-4 py-3">Human, dashboard</td>
                </tr>
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">Eventbrite survey</td>
                  <td className="px-4 py-3">Human, bundled tool</td>
                  <td className="px-4 py-3">Human, CSV export</td>
                </tr>
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">Google Forms</td>
                  <td className="px-4 py-3">Human, visual builder</td>
                  <td className="px-4 py-3">Human, Sheets</td>
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
            If your event is already running on Sched or Whova and you have
            time to read the responses by eye, use the bundled survey. If
            you&apos;re a volunteer meetup organizer who just wants structured
            feedback without extra tooling, HumanSurvey is probably the lowest
            overhead — especially if Claude is already the tool you use to
            draft the post-event email.
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
                ). Full config snippet in the{' '}
                <Link href="/docs" className="underline underline-offset-2">
                  docs
                </Link>
                .
              </>,
              <>
                Ask Claude:{' '}
                <em>&quot;create an API key for HumanSurvey.&quot;</em> It
                calls{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
                  create_key
                </code>
                . Next time an event wraps, describe the retro you want —
                Claude does the rest.
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
              <Link
                href="/use-cases/community-feedback"
                className="underline underline-offset-2 hover:text-slate-950"
              >
                Community feedback
              </Link>{' '}
              — for Discord / Slack / Telegram members
            </li>
            <li>
              ·{' '}
              <Link
                href="/use-cases/product-launch"
                className="underline underline-offset-2 hover:text-slate-950"
              >
                Product launch feedback
              </Link>{' '}
              — for indie makers and PMs
            </li>
            <li>
              ·{' '}
              <Link href="/faq" className="underline underline-offset-2 hover:text-slate-950">
                FAQ
              </Link>{' '}
              — anonymity, distribution, pricing, agent compatibility
            </li>
            <li>
              ·{' '}
              <a
                href="/use-cases/events.md"
                className="underline underline-offset-2 hover:text-slate-950"
              >
                View this page as markdown
              </a>{' '}
              — for agent context / LLM readers
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
