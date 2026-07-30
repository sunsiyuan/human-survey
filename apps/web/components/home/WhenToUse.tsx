/**
 * The fit signal, kept as a shape because it earns trust faster than anything else on the
 * page, and rewritten because the content it used to hold is now inverted: the old list
 * named marketing-funnel lead capture as an anti-fit, and that is the product.
 *
 * The right-hand column is deliberately not a softened version of the left. It names the
 * ceiling — self-report is what a person says they remember, and no amount of tooling
 * turns that into what they did.
 *
 * The last item earns its length. It used to call a channel with its own console the wrong
 * fit, while the picker ~900px above ships Google and LinkedIn as default rows — two
 * defensible claims that read as one contradiction to anyone who scrolled past both. Both
 * survive only if the reason is stated: such a channel does not need this to be counted,
 * but it is the only source of ground truth, and ground truth is what turns the channels
 * with no console from directional into planable (docs/design/attribution-pivot.md §8).
 */

const fits = [
  'The exposure happens somewhere your tracking cannot reach — TikTok in-app, a podcast, a Discord, an AI assistant, one person telling another',
  'A large share of your signups land as Direct / (not set), and someone is about to make a budget decision on the rest',
  'Spend is going to named creators, shows or communities, and nobody can say which of them converted',
  'You need channel numbers you can put next to revenue, not next to sessions',
  'The same channel needs measuring in two places, because the ratio between the two shares — times your overall signup-to-paid rate — is the only conversion rate you will get for it',
  'Free text has piled up — "the office skits girl" — and wants resolving to real people, retroactively and across past months',
]

const nots = [
  {
    what: 'Not analytics.',
    why: 'It sees no sessions, no pageviews, no paths, and it does not deduplicate against your traffic. One answer per person, given by that person.',
  },
  {
    what: 'Not a form builder.',
    why: 'One question, with one follow-up where you want it. NPS, CSAT, post-event feedback and open-ended research are the wrong tool — that capability was removed, not hidden behind a plan.',
  },
  {
    what: 'Not multi-touch attribution.',
    why: 'First touch only. Last touch is near-constant — people search your brand name — and buys no media decision worth the completion rate it costs.',
  },
  {
    what: 'Not a dashboard.',
    why: 'You sign in once to get a key, and that is the whole of the signed-in area. There is no results screen to browse — the aggregates are an API resource and your agent is the reader.',
  },
  {
    what: 'It cannot tell you what a person did.',
    why: 'Only what they say they remember. Skipping is allowed, "I don’t remember" is always on screen, and both come back as their own buckets rather than being folded into a channel to make the chart look decisive.',
  },
  {
    what: 'Not the source of record for a channel with its own console.',
    why: 'Google and LinkedIn already count their own conversions, and no self-report will beat that number. They are still in the default list above, deliberately: a channel with ground truth is the only way to find out how much self-reporting under-reports, since its console gives you the denominator the survey’s own recall is measured against. That coefficient is what makes the channels reporting nothing worth planning against — it is not computed yet, and ships as an explicit null until it is.',
  },
]

export function WhenToUse() {
  return (
    <section id="fit" className="space-y-6">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          Fit
        </p>
        <h2 className="font-display text-3xl tracking-[-0.015em] text-slate-950 sm:text-4xl">
          What this is, and what it is not.
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Reach for it when
          </p>
          <ul className="mt-4 space-y-3 text-[13px] leading-6 text-slate-700">
            {fits.map((fit) => (
              <li key={fit} className="flex gap-2.5">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                <span>{fit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            What it is not
          </p>
          <ul className="mt-4 space-y-3 text-[13px] leading-6 text-slate-600">
            {nots.map((item) => (
              <li key={item.what} className="flex gap-2.5">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>
                  <strong className="font-semibold text-slate-800">{item.what}</strong>{' '}
                  {item.why}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
