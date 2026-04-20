const cases = [
  {
    role: 'Community / brand manager',
    when: 'After an AMA, campaign, or product drop',
    loop: [
      'Tells AI: "ask attendees to rate the session + what they want next"',
      'Gets a link, drops it in Discord / Slack / email',
      'Next day, AI reads back ratings, themes, and top complaints',
    ],
    sample: {
      title: 'Community AMA feedback',
      q: [
        { type: 'scale', label: 'Rate the session (1–5)', min: 1, max: 5 },
        { type: 'multi_choice', label: 'Topics you want next?' },
        { type: 'text', label: 'One thing to change next time?' },
      ],
    },
  },
  {
    role: 'Indie maker / PM',
    when: 'A week after a new-product launch',
    loop: [
      'Tells AI: "survey our first 200 users — why they signed up, top paper cut"',
      'Agent creates the survey; link goes in the welcome email',
      'AI returns ranked pain points; roadmap issues auto-updated',
    ],
    sample: {
      title: 'What should we ship next?',
      q: [
        { type: 'multi_choice', label: 'Top 3 features you\u2019d use' },
        { type: 'text', label: 'Biggest paper cut so far?' },
        { type: 'scale', label: 'Likelihood to recommend (0–10)', min: 0, max: 10 },
      ],
    },
  },
  {
    role: 'Event organizer',
    when: 'After a conference, meetup, or webinar',
    loop: [
      'Tells AI: "rate each session, capture speaker feedback, collect next-event suggestions"',
      'Link sent via the event app or post-event email',
      'AI writes the retro with session-level breakdowns',
    ],
    sample: {
      title: 'Post-Event Feedback',
      q: [
        { type: 'matrix', label: 'Rate each session' },
        { type: 'scale', label: 'Overall event rating (1–5)', min: 1, max: 5 },
        { type: 'text', label: 'What should we do differently?' },
      ],
    },
  },
]

export function UseCases() {
  return (
    <section id="use-cases" className="space-y-8">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          Who uses it
        </p>
        <h2 className="font-display text-3xl tracking-[-0.015em] text-slate-950 sm:text-4xl">
          Whoever needs to hear from a crowd outside their company.
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
          The unifying shape: an audience of members, customers, or attendees —
          answers that can arrive over hours or days — a synthesis your AI can
          act on.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cases.map((c) => (
          <article
            key={c.role}
            className="flex flex-col gap-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm"
          >
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                {c.role}
              </p>
              <p className="text-sm font-medium leading-5 text-slate-900">
                {c.when}
              </p>
            </div>

            <ol className="space-y-2 text-[13px] leading-5 text-slate-600">
              {c.loop.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[1px] shrink-0 font-mono text-[10px] text-[var(--accent)]">
                    0{i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-auto rounded-xl border border-[var(--panel-border)] bg-[var(--code-surface)] px-3 py-3 font-mono text-[11px] leading-5 text-[var(--accent-fg)]">
              <div className="text-slate-400">{'// schema sketch'}</div>
              <div className="text-slate-500">{`title: "${c.sample.title}"`}</div>
              {c.sample.q.map((q, i) => (
                <div key={i} className="truncate">
                  <span className="text-emerald-300">{q.type}</span>
                  <span className="text-slate-400"> · {q.label}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
