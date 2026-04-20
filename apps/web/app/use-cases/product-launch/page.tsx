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
  title: 'Product launch feedback with AI — HumanSurvey use case',
  description:
    'How indie makers and PMs collect structured feedback from the first users of a newly launched product — NPS, positioning validation, pricing signals, top paper cuts — by telling Claude (or any agent) what to learn.',
  alternates: {
    canonical: '/use-cases/product-launch',
    types: { 'text/markdown': '/use-cases/product-launch.md' },
  },
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Product launch feedback with AI: the schema-in, JSON-out loop',
  description:
    'A worked walkthrough of using HumanSurvey and Claude to collect and synthesize feedback from the first users after a product launch.',
  datePublished: '2026-04-20',
  dateModified: '2026-04-20',
  author: { '@type': 'Organization', name: 'HumanSurvey' },
  publisher: { '@type': 'Organization', name: 'HumanSurvey' },
  mainEntityOfPage: 'https://www.humansurvey.co/use-cases/product-launch',
}

export default function ProductLaunchPage() {
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
            Use case · Indie makers / PMs
          </p>
          <h1 className="text-4xl font-normal tracking-[-0.015em] text-slate-950 sm:text-5xl">
            Post-launch feedback, the AI-native way.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            You shipped something. Maybe it went well on Product Hunt — 600
            upvotes, 240 sign-ups. Maybe it was a quiet beta drop to your
            waitlist of 400. Either way, the next question is the same:{' '}
            <em>what do these early users actually think?</em>{' '}
            <strong className="font-semibold text-slate-900">
              This page is about running that feedback loop through an AI
              agent, end to end — schema in, synthesis out, no Typeform and no
              spreadsheet.
            </strong>
          </p>
        </section>

        <Section tag="The old way">
          <p>
            Open Typeform or Google Forms. Rebuild a post-launch survey from
            scratch — NPS, some open text, maybe a feature ranking grid.
            Duplicate in Canny or Intercom Surveys if you want product-managed
            voting. Drop the link in the welcome email. Follow up three days
            later with a reminder. Export the CSV. Skim 140 rows of feedback.
            Open a doc. Try to write a coherent synthesis. Triage feature
            requests by hand. Manually update the top five into your Linear or
            GitHub roadmap.
          </p>
          <p>
            Every step of that pipeline assumes a human is doing the reading.
            But if you already have Claude or Cursor open while you&apos;re
            building your product — and you almost certainly do — the shape of
            the right tool changes. The agent can design the schema, own the
            loop, and hand you a grounded synthesis. The hosted form becomes an
            implementation detail.
          </p>
        </Section>

        <Section tag="The new loop">
          <p>
            HumanSurvey is a thin, opinionated survey API plus an MCP server.
            Your agent already has context — it knows your product, your
            positioning, and the questions that are actually open for you right
            now. You tell it what you want to learn. It does the rest:
          </p>
          <Ordered
            items={[
              'Designs the schema from your intent — NPS, choice questions with options from your positioning hypotheses, scales for pricing signal, open text for qualitative.',
              'Creates the survey, returns /s/{id}. You paste into the welcome email, Discord, or Slack. Or ask your agent to post if it has an email/channel tool.',
              'On demand, retrieves results and summarizes. "What did our first users say?" becomes a structured answer with percentages, themes, and suggested moves — all grounded in actual response JSON.',
            ]}
          />
          <p>
            Nothing in this loop requires you to leave your agent conversation.
            No tab-switching, no export-to-CSV, no &ldquo;I&apos;ll read the
            responses this weekend&rdquo; that turns into never.
          </p>
        </Section>

        <Section tag="Worked example — post-launch survey for your first 200 sign-ups">
          <p>
            You launched a new analytics tool for e-commerce stores. 240 people
            signed up in the first 48 hours. You want to learn: is the
            positioning landing, what&apos;s the biggest friction, are people
            willing to pay at your intended price? You open Claude Code with
            HumanSurvey installed and say:
          </p>

          <Quote>
            &ldquo;Survey our first 200 sign-ups. I want: NPS 0–10; why they
            signed up (the positioning options: replacing their current
            analytics / integrating with Shopify / because of our pricing / the
            AI-summary feature); biggest paper cut so far as open text; would
            they pay at $29/month (yes / maybe / no). Keep it 2 minutes.&rdquo;
          </Quote>

          <p>Claude generates a schema roughly like:</p>

          <CodeBlock>{`{
  "title": "How's it going so far?",
  "description": "Two minutes. Helps us prioritize what to build next.",
  "sections": [{
    "questions": [
      { "type": "scale", "label": "How likely are you to recommend us to a friend?",
        "min": 0, "max": 10,
        "minLabel": "Not at all", "maxLabel": "Definitely" },
      { "type": "multi_choice", "label": "Why did you sign up?",
        "options": [
          { "label": "Replacing my current analytics tool" },
          { "label": "Native Shopify integration" },
          { "label": "The pricing is better than alternatives" },
          { "label": "The AI summary feature" },
          { "label": "Other" }
        ]
      },
      { "type": "text", "label": "Biggest paper cut so far?" },
      { "type": "single_choice", "label": "Would you pay $29 / month for this?",
        "options": [
          { "label": "Yes" }, { "label": "Maybe" }, { "label": "No" }
        ]
      }
    ]
  }],
  "max_responses": 240,
  "expires_at": "2026-04-27T23:59:00Z"
}`}</CodeBlock>

          <p>
            Claude calls{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              create_survey
            </code>
            , returns <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">https://www.humansurvey.co/s/lnc789</code>.
            You drop it in the welcome email Resend automation. A week later,
            you ask:
          </p>

          <Quote>&ldquo;What did our first users say?&rdquo;</Quote>

          <p>
            Claude calls{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">
              get_results
            </code>{' '}
            and returns:
          </p>

          <CodeBlock>{`112 responses (56%). NPS: 42.
  — 38% promoters, 44% passives, 18% detractors.
  — Detractor theme (open text): slow initial data sync.

Why they signed up:
  1. Native Shopify integration (63%) — clear lead.
  2. AI summary feature (51%).
  3. Replacing current analytics (28%) ← the positioning we lead with.
  4. Pricing (22%).

Biggest paper cut (top themes from 94 open-text responses):
  1. Google SSO missing (41 mentions) — by far the loudest.
  2. Initial data sync is slow (18 mentions) — matches detractor NPS cluster.
  3. No way to invite teammates yet (12 mentions).

Pricing at $29/month: 67% yes, 24% maybe, 9% no.
At $39/month (follow-up segment): 48% yes. Demand curve
  suggests $29 is close to the right anchor.

Suggested moves:
  1. Rewrite the hero: lead with Shopify integration, not
     "replacing your analytics tool".
  2. Ship Google SSO this week — it's the #1 loudest complaint.
  3. Diagnose the initial sync latency — it's hitting both the
     paper-cut list and the detractor segment.
  4. Anchor pricing at $29; test $35 in a later cohort.`}</CodeBlock>

          <p>
            Every number and theme in that synthesis is traceable back to the
            raw JSON. You didn&apos;t read 112 responses by hand. You
            didn&apos;t triage by gut feel. And you got a concrete list of four
            actions you can execute before lunch.
          </p>
        </Section>

        <Section tag="Other launch scenarios that fit the same loop">
          <Unordered
            items={[
              <>
                <strong className="font-semibold text-slate-900">
                  Waitlist warm-up survey.
                </strong>{' '}
                Before you ship, ask your waitlist which features they&apos;d
                use first, what they&apos;re currently paying elsewhere, and
                what would unlock them switching. Free, early positioning data.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Private-beta weekly pulse.
                </strong>{' '}
                Every Friday during beta, send beta users a 3-question check —
                what they tried this week, what broke, what would they ship
                next. Your agent stitches the weekly results into a running
                changelog-driven narrative.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Pricing validation (van Westendorp style).
                </strong>{' '}
                Four scale questions on price sensitivity. Your agent computes
                the optimal price range and tells you where to anchor.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Churn / cancellation exit survey.
                </strong>{' '}
                Triggered when a user downgrades. Structured reasons + free
                text. Agent surfaces the top-three recurring reasons monthly
                and flags individual responses worth replying to.
              </>,
              <>
                <strong className="font-semibold text-slate-900">
                  Rolling NPS on a cohort basis.
                </strong>{' '}
                One survey per monthly sign-up cohort with an{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px]">
                  expires_at
                </code>{' '}
                of +30 days. Your agent graphs NPS by cohort and tells you if
                recent product changes moved the number.
              </>,
            ]}
          />
        </Section>

        <Section tag="How this compares">
          <p>
            Post-launch feedback tools fall into three rough buckets. Pick the
            one that matches how your feedback will be consumed:
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
                  <td className="px-4 py-3 font-medium text-slate-900">Typeform</td>
                  <td className="px-4 py-3">Human, visual builder</td>
                  <td className="px-4 py-3">Human, dashboard</td>
                </tr>
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">Canny</td>
                  <td className="px-4 py-3">Users post feature requests</td>
                  <td className="px-4 py-3">Human, vote dashboard</td>
                </tr>
                <tr className="border-b border-[var(--panel-border)]">
                  <td className="px-4 py-3 font-medium text-slate-900">Intercom Surveys</td>
                  <td className="px-4 py-3">Human, in-platform</td>
                  <td className="px-4 py-3">Human, Intercom dashboard</td>
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
            If you&apos;re going to read every response yourself, Typeform has
            a nicer reading experience. If you want users to post and vote on
            feature requests as a running list, Canny is a different shape of
            product. HumanSurvey is the right pick when your agent is already
            in the loop and you want the synthesis to flow back into its
            context — not a dashboard you&apos;ll open once a week.
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
                . Next time you want to survey your users, just describe what
                you want to learn.
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
                href="/use-cases/events"
                className="underline underline-offset-2 hover:text-slate-950"
              >
                Event feedback
              </Link>{' '}
              — conferences, meetups, webinars
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
                href="/use-cases/product-launch.md"
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
