/**
 * §3.7. Payment flow first, signup flow second, and then the number the pair produces —
 * which is the most valuable thing on this page and the one thing no incumbent can
 * output, because no incumbent asks twice.
 */

const placements = [
  {
    order: '01',
    where: 'Your payment or upgrade flow',
    lead: 'The answer arrives already joined to revenue.',
    body: 'The person just paid, so you know what they are worth without installing any conversion tracking. Motivation peaks right after a commitment, and the confirmation screen is dead space anyway. "This channel produced a quarter of last month’s new revenue" is the sentence a budget holder acts on.',
  },
  {
    order: '02',
    where: 'Your signup flow',
    lead: 'The only way to see the people a channel sends who never pay.',
    body: 'Ask at payment alone and you can never learn that a channel delivers volume that does not convert — which is exactly the judgment that kills a bad line item. Ask early in the flow, too: memory decays, and asking later means asking only the people who stayed.',
  },
]

export function Placements() {
  return (
    <section id="placements" className="space-y-6">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          Where it goes
        </p>
        <h2 className="font-display text-3xl tracking-[-0.015em] text-slate-950 sm:text-4xl">
          Two placements, and a number neither one gives alone.
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
          One embed each, in flows you already own. An iframe and a{' '}
          <code className="font-mono text-[13px]">postMessage</code> listener, sized to the
          host page, themed to match it.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {placements.map((placement) => (
          <article
            key={placement.order}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm"
          >
            <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--accent)]">
              {placement.order}
            </p>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-slate-950">{placement.where}</h3>
              <p className="text-[15px] leading-6 text-slate-900">{placement.lead}</p>
            </div>
            <p className="text-[13px] leading-6 text-slate-600">{placement.body}</p>
          </article>
        ))}
      </div>

      {/* The payoff. Deliberately spelled out as arithmetic rather than named as a
          feature: it is a claim a reader can check, and checking it is what makes the
          second placement worth the work. */}
      <div className="grid gap-6 rounded-2xl border border-[var(--accent)]/25 bg-white/70 px-5 py-5 backdrop-blur-sm sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Run both
          </p>
          <p className="mt-3 text-[15px] leading-7 text-slate-900 sm:text-base sm:leading-8">
            A channel that is 30% of your signups and 12% of your payers is being flattered
            by the signup number, and now you can see it. Divide a channel&apos;s share of
            the paying population by its share of the signup population: above 1 it converts
            better than your average, below 1 worse. Multiply that ratio by your overall
            signup-to-paid rate and you have{' '}
            <strong>that channel&apos;s own conversion rate</strong> — for a channel that
            sends no referrer and appears nowhere in your analytics. Two forms, one question
            each. Nobody else produces this, because nobody else asks twice.
          </p>
        </div>
        <div className="lg:border-l lg:border-[var(--panel-border)] lg:pl-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            And the shares are honest
          </p>
          <p className="mt-3 text-[13px] leading-6 text-slate-600">
            Every share ships with the base it was computed over, and the people who skipped
            or did not remember stay inside that base instead of quietly disappearing from
            it. A percentage without its denominator gets misread, and the usual misreading
            flatters every channel at once.
          </p>
        </div>
      </div>
    </section>
  )
}
