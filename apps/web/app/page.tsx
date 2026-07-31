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
 * Cut again, deliberately, after the first revamp still read as an essay: the two-placement
 * arithmetic, the no-dashboard section and the answer to "I'd just add a text field" all
 * came off. Each is a good argument and none of them is a first-screen argument — a visitor
 * who has not yet understood WHAT this asks cannot evaluate WHY it asks twice. They are one
 * click away in the twin and on /faq.
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
              TikTok in-app, podcasts, Slack groups, word of mouth, ChatGPT — none of them
              send a referrer, so your analytics files them all under Direct. Ask the person
              instead, in your own signup or checkout. Then ask which account, so the answer
              is <strong>Jade, @jade.work0</strong> and not <strong>TikTok</strong>.
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
                You scanned that. You did not read it.
              </p>
            </div>
          </div>
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
            It records what a person says they remember, not what they did. Google and
            LinkedIn are in the list on purpose — they count their own conversions, and that
            is the only way to find out how much self-report undercounts everything else. We
            have not measured that yet, so it ships as an explicit null rather than a guess.
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
