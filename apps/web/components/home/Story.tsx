const steps = [
  {
    when: 'Friday',
    who: 'You',
    said: 'You just wrapped an AMA with 400 community members. Great session — now you want to know what they thought.',
  },
  {
    when: 'Monday',
    who: 'You → Claude',
    said: '"Send everyone who attended a 3-question feedback form — rate the session 1–5, one thing to change, the topic they want next."',
    result:
      'Claude writes the schema, creates the survey, hands back /s/abc123. You drop the link in #general. Or ask Claude to post it for you.',
  },
  {
    when: 'Tuesday',
    who: 'You → Claude',
    said: '"What did people think?"',
    result:
      '"184 responses. 4.3/5 average. 60% want an infra-scaling deep dive next. Top complaint: too many interruptions during live Q&A."',
  },
]

export function Story() {
  return (
    <section id="loop" className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          The loop
        </p>
        <h2 className="font-display text-3xl tracking-[-0.015em] text-slate-950 sm:text-4xl">
          No more Typeform. No more chasing responses. No more pivot tables.
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
          Here&apos;s what running a community feedback loop looks like once
          your AI can do it for you:
        </p>
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li
            key={i}
            className="grid gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-4 backdrop-blur-sm md:grid-cols-[7rem_1fr]"
          >
            <div className="flex flex-col gap-0.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                {s.when}
              </p>
              <p className="text-[11px] text-slate-500">{s.who}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[15px] leading-6 text-slate-900">{s.said}</p>
              {s.result ? (
                <p className="text-[13px] leading-5 text-slate-600">
                  {s.result}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="max-w-2xl text-[12px] leading-5 text-slate-500">
        HumanSurvey returns you a share link. You (or your agent, if it has a
        Slack/Discord/email tool) post it where your audience already lives — we
        don&apos;t email-blast for you. That&apos;s by design.
      </p>
    </section>
  )
}
