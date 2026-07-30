import Link from 'next/link'

import { Wordmark } from '@/components/Logo'

import { PickerDemo } from '@/components/home/PickerDemo'
import { Placements } from '@/components/home/Placements'
import { Setup } from '@/components/home/Setup'
import { WhenToUse } from '@/components/home/WhenToUse'

/**
 * The homepage has two readers and one page to satisfy both (docs/design/
 * attribution-pivot.md §11):
 *
 *   1. a human who has thirty seconds to decide this measures something they cannot
 *      currently measure, and
 *   2. an agent that has to come away able to install and configure it.
 *
 * The first one is why the H1 states an outcome rather than a category, why the picker is
 * real and usable rather than a screenshot, and why the MCP config is a named beat near
 * the bottom instead of the hero. The second is why every claim on the page has a link to
 * the exact endpoint that backs it.
 */

const links = [
  ['GitHub', 'https://github.com/sunsiyuan/human-survey'],
  ['npm: humansurvey-mcp', 'https://www.npmjs.com/package/humansurvey-mcp'],
  ['Docs', '/docs'],
  ['Use cases', '/use-cases'],
  ['FAQ', '/faq'],
  ['Changelog', '/changelog'],
  ['OpenAPI', '/api/openapi.json'],
  ['llms.txt', '/llms.txt'],
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      {/* Block flow with vertical rhythm, deliberately not `flex flex-col gap-*`. A flex
          item's automatic minimum size is its min-content width, so a flex column lets a
          nowrap row inside the picker — or a long line in a code block — push the whole
          document wider than the viewport and give the page a horizontal scrollbar on a
          phone. Block children take the container's width and cannot do that. */}
      <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-8 sm:space-y-20 sm:px-6 sm:py-10 lg:px-8">

        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          {/* The tagline that used to sit here said "Self-reported attribution", which the H1
              two lines below says better and at greater length. A header's job is to say whose
              site this is. */}
          <Link href="/" aria-label="HumanSurvey home">
            <Wordmark />
          </Link>
          <div className="flex gap-2">
            <Link
              href="/docs"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Docs
            </Link>
            <Link
              href="/faq"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              FAQ
            </Link>
            <Link
              href="/use-cases"
              className="hidden min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 sm:inline-flex"
            >
              Use cases
            </Link>
            <a
              href="https://github.com/sunsiyuan/human-survey"
              target="_blank"
              rel="noreferrer"
              className="hidden min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 sm:inline-flex"
            >
              GitHub
            </a>
          </div>
        </header>

        {/* Hero — copy left, the live form right, so the proof is above the fold rather
            than argued for above the fold. */}
        {/* 28rem, not 26: the widest catalog label ("Someone at my company was already
            using it") truncates below about 27rem, and a row of ellipsis on the one
            element whose job is to prove the list is scannable reads as a defect. */}
        <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-12">
          {/* min-w-0 on both tracks: a grid item's automatic minimum is min-content too,
              and the picker's rows carry nowrap labels. Without it the single-column
              mobile layout is 60px wider than the phone. */}
          <div className="min-w-0">
            <h1 className="text-[2.4rem] leading-[1.08] tracking-[-0.02em] text-slate-950 sm:text-[3.5rem] sm:leading-[1.02] sm:tracking-[-0.025em]">
              Find out where your signups actually come from.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-[1.7] text-slate-800 sm:text-lg sm:leading-8">
              TikTok in-app, Instagram, podcasts, Slack groups, word of mouth, ChatGPT: none
              of them send a referrer, so your analytics files them all under Direct. Ask the
              person instead — inside your own signup or payment flow — and ask a second
              question in place, so the answer is <strong>Jade, @jade.work0</strong> and not{' '}
              <strong>TikTok</strong>.
            </p>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">
              Six ambassador accounts collapse into one string, and every conclusion drawn
              from that string is noise. Granularity is the entire point: which account, which
              show, which event.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#setup"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Set it up
              </a>
              <Link
                href="/docs"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-900 px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white"
              >
                Docs
              </Link>
              <a
                href="#placements"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                Where it goes
              </a>
            </div>

            {/* The read side, compressed to three lines. It is here rather than in a
                section of its own because the answer to "and then what?" is the last
                thing a buyer needs before they will read anything else, and because an
                agent scanning this page for what to call finds it above the fold. */}
            <dl className="mt-10 space-y-3 border-t border-[var(--panel-border)] pt-6 text-[13px] leading-6">
              <div className="grid gap-0.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-4">
                <dt className="shrink-0 font-mono text-[12px] text-[var(--accent-strong)]">
                  <a href="/docs#rollup" className="hover:underline">
                    /rollup
                  </a>
                </dt>
                <dd className="text-slate-600">
                  Every channel and every creator, each share next to the base it was
                  computed over, for any window you ask about.
                </dd>
              </div>
              <div className="grid gap-0.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-4">
                <dt className="shrink-0 font-mono text-[12px] text-[var(--accent-strong)]">
                  <a href="/docs#async-results" className="hover:underline">
                    ?since_seq
                  </a>
                </dt>
                <dd className="text-slate-600">
                  The answers themselves, one row per person, deltas only. Nothing to poll
                  for a terminal state — the form never closes.
                </dd>
              </div>
              <div className="grid gap-0.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-4">
                <dt className="shrink-0 font-mono text-[12px] text-[var(--accent-strong)]">
                  <a href="/docs#events" className="hover:underline">
                    external_id
                  </a>
                </dt>
                <dd className="text-slate-600">
                  Your own user id, passed in with the answer. Push your payment events
                  against it and channel × heads becomes channel × revenue.
                </dd>
              </div>
            </dl>
          </div>

          <PickerDemo />
        </section>

        {/* The punchline of the demo, stated once it has already happened. */}
        <section className="max-w-3xl">
          <h2 className="font-display text-2xl tracking-[-0.015em] text-slate-950 sm:text-3xl">
            You scanned that. You did not read it.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
            Brand names carry logos, and recognizing an image beats reading a line of text by
            roughly an order of magnitude — which is what makes a twelve-row list affordable
            where eight rows of &ldquo;social media&rdquo; and &ldquo;online ad&rdquo; would
            not be. Logos, then avatars: recognition all the way down, no reading
            comprehension at any step, and no taxonomy for anyone to translate their memory
            into.
          </p>
          <p className="mt-4 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
            That is also why the list is long. A channel you leave off does not cost you one
            data point — its people pick something else, so you lose that channel{' '}
            <em>and</em>{' '}book a false entry against another one. Order is randomized per
            respondent for the same reason: options shown first get picked more, and an
            attribution tool that sorts by spend would keep confirming last month&apos;s
            budget.
          </p>
        </section>

        {/* Two placements, and the number they produce together */}
        <Placements />

        {/* Honest fit — including the ceiling */}
        <WhenToUse />

        {/* How it gets set up */}
        <Setup />

        {/* Footer links */}
        <footer className="flex flex-wrap gap-3 border-t border-[var(--panel-border)] pt-8">
          {links.map(([label, href]) => (
            <a
              key={label}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noreferrer' : undefined}
              className="text-sm text-slate-500 transition hover:text-slate-900"
            >
              {label}
            </a>
          ))}
        </footer>

      </div>
    </main>
  )
}
