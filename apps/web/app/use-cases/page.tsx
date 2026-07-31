import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Use cases — HumanSurvey',
  description:
    'Four channel classes that reach people somewhere analytics cannot see: AI assistants, communities and word of mouth, launch day, and podcasts and events. Each one lands in Direct, and each one is answerable by asking the person.',
  alternates: {
    canonical: '/use-cases',
    types: { 'text/markdown': '/use-cases.md' },
  },
}

type Item = {
  channel: string
  headline: string
  body: string
  href: string
}

// Ordered by how much of the discovery each class hides, which is also roughly how
// often it comes up. AI assistants lead: the referrer is gone even when the click
// happens, and most of the time the click does not happen at all.
const items: Item[] = [
  {
    channel: 'AI assistants',
    headline: 'ChatGPT, Claude, Perplexity and Gemini all arrive as Direct',
    body:
      'No referrer leaves an assistant, and most of the time there is no click to carry one: the person reads your name in an answer, searches it, and lands on you from Google. So the option has to say “ChatGPT” — not “AI assistant” — and sit beside Google rather than under it. The follow-up can ask what they were asking about, which gets you a real question from someone who then paid.',
    href: '/use-cases/ai-assistants',
  },
  {
    channel: 'Communities and word of mouth',
    headline: 'Someone pasted your link in a Slack you will never see',
    body:
      'Discord, Slack groups, subreddits, a friend forwarding a message. The exposure happens inside somebody else’s room, and by the time the link is clicked it has been re-pasted twice and stripped of everything. The follow-up gets you which room — “a community” is not something you can go and do more of.',
    href: '/use-cases/community-feedback',
  },
  {
    channel: 'Launch day',
    headline: 'You posted in six places and the spike says Direct',
    body:
      'Product Hunt, Hacker News, X, three newsletters, a dozen DMs. In-app browsers and forwarded links drop the referrer, so the traffic that decides whether the launch worked is exactly the traffic you cannot attribute. Ask at signup and you learn which post; ask again at payment and you learn which post sent people who pay.',
    href: '/use-cases/product-launch',
  },
  {
    channel: 'Podcasts and events',
    headline: 'A spoken mention has no link to lose',
    body:
      'A sponsored episode, a conference talk, a booth conversation. Nobody clicks anything — they hear a name in a car and type it in a week later. The follow-up asks which show or which event, because “a podcast” is not a media-buying decision.',
    href: '/use-cases/events',
  },
]

/**
 * The CollectionPage here used to declare a collection and then list none of its members,
 * which is the one thing a collection is for. The members are derived from `items` so the
 * graph cannot list a page this index does not link to, and the ItemList carries an @id so
 * the four use-case pages can say they are part of it.
 */
const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': 'https://www.humansurvey.co/use-cases#page',
      url: 'https://www.humansurvey.co/use-cases',
      name: 'HumanSurvey use cases',
      description:
        'Channel classes with no referrer — AI assistants, communities, launch posts, podcasts and events — and how self-reported attribution measures each one down to the person and the content.',
      publisher: { '@id': 'https://www.humansurvey.co/#org' },
      isPartOf: { '@id': 'https://www.humansurvey.co/#site' },
      about: { '@id': 'https://www.humansurvey.co/#app' },
      mainEntity: { '@id': 'https://www.humansurvey.co/use-cases#list' },
    },
    {
      '@type': 'ItemList',
      '@id': 'https://www.humansurvey.co/use-cases#list',
      name: 'HumanSurvey use cases',
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.channel,
        url: `https://www.humansurvey.co${it.href}`,
      })),
    },
  ],
}

export default function UseCasesIndex() {
  return (
    <main data-palette="growth" className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
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

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Use cases
          </p>
          <h1 className="text-4xl tracking-[-0.02em] text-slate-950 sm:text-5xl">
            Four channels your analytics files under Direct.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            One class of problem, four faces of it: the exposure happened somewhere tracking
            cannot reach, so every one of these people lands in the same bucket as someone
            typing your domain from memory. Asking them is the only signal that survives all
            four.
          </p>
          <p className="text-base leading-[1.7] text-slate-800">
            <strong className="font-semibold text-slate-900">
              &ldquo;TikTok&rdquo; is not an answer
            </strong>{' '}
            — six ambassador accounts collapse into one string and every conclusion drawn
            from it is noise. Each walkthrough below covers the second question that gets you
            to which account, which room, which show, and where to place the form so the
            answer sits next to revenue.
          </p>
        </section>

        <section className="space-y-4" id="walkthroughs">
          {items.map((it) => (
            <article
              key={it.href}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                {it.channel}
              </p>
              <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-950">
                {it.headline}
              </h2>
              <p className="mt-2 text-[15px] leading-[1.7] text-slate-800">{it.body}</p>
              <Link
                href={it.href}
                className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--accent-strong)] px-4 text-xs font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] hover:text-[var(--accent-fg)]"
              >
                Read the walkthrough →
              </Link>
            </article>
          ))}
        </section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Not on this list
          </p>
          <p className="text-sm leading-6 text-slate-700">
            Channels with their own reporting console — LinkedIn Ads, Google Ads — already
            have ground truth, and are not what this measures. Their role here is the
            reverse: a calibration anchor you can compare self-report against, to see how
            much self-report under-counts.
          </p>
          <p className="text-sm leading-6 text-slate-700">
            <a
              href="/use-cases.md"
              className="underline underline-offset-2 hover:text-slate-950"
            >
              View this page as markdown
            </a>{' '}
            — for agent context / LLM readers.
          </p>
        </section>
      </div>
    </main>
  )
}
