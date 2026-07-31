import Link from 'next/link'

import { Wordmark } from '@/components/Logo'

import { AgentPrompt } from '@/components/home/AgentPrompt'
import { PickerDemo } from '@/components/home/PickerDemo'

/**
 * The homepage has two readers and one page to satisfy both (docs/design/
 * attribution-pivot.md §11):
 *
 *   1. a human who has thirty seconds to decide this measures something they cannot
 *      currently measure, and
 *   2. an agent that has to come away able to install and configure it.
 *
 * §11 settled that as "one page, two readers". That is now half true: the agent's copy
 * lives at /index.md, the markdown twin every other page already had and this one did not.
 * The reason is that satisfying both readers in one document is what grew this page to
 * 1,459 words — four of its five sections argued FOR THE CATEGORY (why ask at all, why
 * logos, why a long list) to a human who had not yet been shown the product, while the
 * only thing the buyer came to do sat at section five, step 02 of an ordered list.
 *
 * So: this page demonstrates, /index.md explains, and nothing was deleted — the cut prose
 * is in the twin verbatim, and in /faq and /about where it already lived.
 *
 * The hero is one card with two labelled panes because the framing question — show the
 * buyer's act, like Resend, or show the respondent's screen — has a wrong answer either
 * way. Resend can show four lines of code alone because everyone knows what an email is.
 * Show only the buyer's act here and "ask people how they heard about you" reads as a form
 * you could build tonight. Show only the picker and it reads as a form builder, which is
 * the misfiling this pivot deleted a whole product to escape.
 */

// /about is what llms.txt nominates as the brand hub and the page to quote from, and until
// this entry existed no HTML page on the site linked to it — so the one page written to be
// cited was reachable only by an agent that had already read llms.txt.
const links = [
  ['GitHub', 'https://github.com/sunsiyuan/human-survey'],
  ['npm: humansurvey-mcp', 'https://www.npmjs.com/package/humansurvey-mcp'],
  ['About', '/about'],
  ['Docs', '/docs'],
  ['Use cases', '/use-cases'],
  ['FAQ', '/faq'],
  ['Changelog', '/changelog'],
  ['OpenAPI', '/api/openapi.json'],
  ['llms.txt', '/llms.txt'],
  ['This page as markdown', '/index.md'],
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
            {/* Filled rather than outlined, unlike everything beside it. This is the only
                thing in the header a visitor can do rather than read, and it was missing
                entirely — /signin existed and worked, and nothing on the site pointed at it. */}
            <Link
              href="/signin"
              className="inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--accent-strong)] px-4 text-sm font-medium text-[var(--accent-fg)] transition hover:bg-slate-900"
            >
              Sign in
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="space-y-10">
          <div className="max-w-3xl">
            <h1 className="text-[2.4rem] leading-[1.08] tracking-[-0.02em] text-slate-950 sm:text-[3.5rem] sm:leading-[1.02] sm:tracking-[-0.025em]">
              Find out where your signups actually come from.
            </h1>
            <p className="mt-6 text-base leading-[1.7] text-slate-800 sm:text-lg sm:leading-8">
              TikTok in-app, Instagram, podcasts, Slack groups, word of mouth, ChatGPT: none
              of them send a referrer, so your analytics files them all under Direct. Ask the
              person instead, inside your own signup or payment flow — and ask a second
              question in place, so the answer is <strong>Jade, @jade.work0</strong> and not{' '}
              <strong>TikTok</strong>.
            </p>
            {/* Two things a visitor can do, not three. The old third button was an anchor to
                a section further down, and an anchor is not an act. */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signin"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Get a key
              </Link>
              <Link
                href="/docs"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-900 px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white"
              >
                Docs
              </Link>
            </div>
          </div>

          {/* 28rem on the picker track, not 26: the widest catalog label ("Someone at my
              company was already using it") truncates below about 27rem, and a row of
              ellipsis on the one element whose job is to prove the list is scannable reads
              as a defect.

              min-w-0 on both tracks: a grid item's automatic minimum is min-content too, and
              the picker's rows carry nowrap labels. Without it the single-column mobile
              layout is 60px wider than the phone. */}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-10">
            <div className="min-w-0">
              <AgentPrompt />
            </div>

            <div className="min-w-0">
              <p className="mb-3 font-mono text-[11px] text-slate-500">
                What your customer sees
              </p>
              {/* Mounted with TikTok already picked, so the follow-up — the whole wedge — is
                  on screen without a click. */}
              <PickerDemo startExpanded />
              {/* The old "You scanned that. You did not read it." section was 180 words
                  explaining a decision the picker performs. It is one caption now. */}
              <p className="mt-3 text-[13px] leading-6 text-slate-600">
                You scanned that. You did not read it. Logos are recognised rather than read,
                which is what makes twelve rows cheaper to answer than eight rows of
                &ldquo;social media&rdquo;.
              </p>
            </div>
          </div>
        </section>

        {/* The number that needs two placements */}
        <section className="max-w-3xl">
          <h2 className="font-display text-2xl tracking-[-0.015em] text-slate-950 sm:text-3xl">
            Two placements, and a number neither gives alone.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
            Ask in the payment flow and the answer arrives already joined to revenue, with no
            conversion tracking to install. Ask at signup too and you see the people a channel
            sends who never pay. Run both, and a channel that is 30% of your signups and 12%
            of your payers is being flattered by the signup number. Divide its share of payers
            by its share of signups and you have how that channel converts against your
            average; multiply that by your overall signup-to-paid rate and you have{' '}
            <em>the channel&apos;s own rate</em> — for a channel that appears nowhere in your
            analytics. No incumbent produces this, because no incumbent asks twice.
          </p>
        </section>

        {/* The read side */}
        <section className="max-w-3xl">
          <h2 className="font-display text-2xl tracking-[-0.015em] text-slate-950 sm:text-3xl">
            There is no dashboard. Your agent is the reader.
          </h2>
          {/* The three deep links were a <dl> in the hero. The shape went, the links did not:
              this is the anchor set the docs page is entered through. */}
          <p className="mt-4 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
            <a href="/docs#rollup" className="font-mono text-[13px] text-[var(--accent-strong)] hover:underline">
              /rollup
            </a>{' '}
            gives you every channel and every creator for any window, each share beside the
            base it was computed over — with skips and &ldquo;I don&apos;t remember&rdquo;
            still inside that base rather than quietly leaving it.{' '}
            <a href="/docs#async-results" className="font-mono text-[13px] text-[var(--accent-strong)] hover:underline">
              ?since_seq
            </a>{' '}
            gives you the answers themselves, one row per person, deltas only; the form never
            closes, so there is no terminal state to poll for.{' '}
            <a href="/docs#events" className="font-mono text-[13px] text-[var(--accent-strong)] hover:underline">
              external_id
            </a>{' '}
            carries your own user id in with the answer, so pushing your payment events
            against it turns channel × heads into channel × revenue. You sign in once, for a
            key. There is no results screen, and there will not be one.
          </p>
        </section>

        {/* The objection every judge on the panel said the page had to answer */}
        <section className="max-w-3xl">
          <h2 className="font-display text-2xl tracking-[-0.015em] text-slate-950 sm:text-3xl">
            &ldquo;I&apos;d just add a text field.&rdquo;
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
            Sometimes you should. If a person is going to read the answers, and there are few
            enough answers for a person to read, this is overhead and a text field is the
            cheaper start. What a text field cannot do is come back. Answers arrive as
            &ldquo;the office skits girl&rdquo; and &ldquo;that AI guy&rdquo; and nothing
            groups them; here one mapping resolves a verbatim string onto a real creator and
            applies backwards across every past month, so something you work out in month
            three still reaches months one and two. A field also shows one fixed order to
            everybody, which makes its shares an artifact of the layout — order is randomized
            per respondent here, so the raw share is unbiased by construction. And it drops
            its skips out of its own denominator, and it joins to nothing.
          </p>
        </section>

        {/* The ceiling, in the product's own voice */}
        <section className="max-w-3xl">
          <h2 className="font-display text-2xl tracking-[-0.015em] text-slate-950 sm:text-3xl">
            What it cannot tell you.
          </h2>
          {/* Rescued from 450 words deep inside the old WhenToUse section, where it was
              invisible. It publishes a null where a lesser page would publish a number, and
              it resolves the contradiction a careful reader has already noticed: why Google
              is in a list of channels that supposedly report nothing. */}
          <p className="mt-4 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
            It records what a person says they remember, not what they did, and it is first
            touch only. Channels with their own console — Google, LinkedIn — stay in the
            default list deliberately: their reported conversions are the ground truth that
            self-report can be measured against, and that ratio is what would make the
            channels reporting nothing worth planning against. We have not measured it. It
            ships as an explicit null rather than a smoothed guess. And it never contacts
            anyone: it returns a URL and an iframe that renders wherever you put it, inside a
            flow you already own.
          </p>
        </section>

        {/* Footer links */}
        <footer className="flex flex-wrap gap-3 border-t border-[var(--panel-border)] pt-8">
          {links.map(([label, href]) => (
            <a
              key={label}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noreferrer' : undefined}
              className="text-sm text-slate-600 underline-offset-4 transition hover:text-slate-950 hover:underline"
            >
              {label}
            </a>
          ))}
        </footer>
      </div>
    </main>
  )
}
