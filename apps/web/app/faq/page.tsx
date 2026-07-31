import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ — HumanSurvey',
  description:
    'Why analytics reports Direct, whether Google Analytics can see TikTok or podcast traffic, how to tell what ChatGPT sends you, what self-reported attribution measures and how far to trust it, where the form goes in a signup or payment flow, and how an agent reads the answers back.',
  alternates: {
    canonical: '/faq',
    types: { 'text/markdown': '/faq.md' },
  },
}

type Faq = {
  q: string
  a: string
}

/**
 * One array, two consumers: the visible copy below and the FAQPage JSON-LD. Kept that way
 * deliberately — a hand-written second copy of the questions for the structured data is a
 * copy that drifts, and the failure is invisible, because the wrong one is the one only
 * crawlers read.
 *
 * public/faq.md is the third consumer and cannot share the array (it is a static file, and
 * the point of a markdown twin is that it needs no JS). It has to be edited in the same
 * change. An agent doing content negotiation on /faq gets the twin, so a twin that says
 * something else is a surface telling two stories.
 *
 * Answers render as plain text, so backticks read as backticks. That is fine and is the
 * existing convention; markdown emphasis is not — it would render as literal asterisks.
 */
/**
 * Order is deliberate. The first block is the questions somebody arrives with before they
 * know this product exists — Direct traffic, GA4's blind spots, what ChatGPT sends —
 * and each one is answered so it stands on its own, naming UTMs and channel consoles
 * where those are the better instrument. Anyone reading the page has already found us,
 * so that block is not for them; it is for the person who typed the problem into an
 * assistant and needs the answer to be true before it is useful. Product questions follow.
 */
const faqs: Faq[] = [
  {
    q: 'How do I find out where my signups actually come from?',
    a: 'Three instruments, and none of them covers what the other two miss. Links you control — ads, your newsletter, your own posts — carry the answer if you tag them: UTM parameters survive the click into your analytics, they cost nothing, and they are the first thing to fix. Channels with their own reporting console — Google Ads, LinkedIn Ads, an affiliate platform — already count the conversions they produced, and that count is closer to ground truth than anything you can reconstruct downstream from it. What neither reaches is an exposure that produced no tagged click: a video, a podcast episode, a Discord thread, your name in an assistant\'s answer, one person telling another. Those people usually arrive weeks later by searching your brand, so every log you own records the search and nothing about the reason. The only signal that survives is the person, which is what HumanSurvey is — one question inside your own signup or payment flow, with a second question in place so the answer is a creator and not a platform.',
  },
  {
    q: 'Why does my analytics say Direct for most of my traffic?',
    a: 'Direct is not a channel. It is the bucket for every visit that arrived without a referrer your analytics could read, and typing the domain from memory is only one of the ways to land in it. The others are ordinary and unfixable: a link opened inside an app\'s own browser, a link carrying `rel="noreferrer"`, a redirector that drops the header, a URL pasted into a chat, an email, a PDF or a slide — none of which are web pages and none of which have a referrer to pass on — a QR code, a mobile app handing the URL to the operating system. Even when a referrer does survive, current browsers default to the Referrer-Policy value `strict-origin-when-cross-origin`, which sends the origin and nothing more, so you learn reddit.com and not which thread, tiktok.com and not which account. None of this is a misconfiguration you can correct, and no analytics vendor can correct it either: the information was destroyed before the request reached you. Direct is large because it is a landfill, and the way to sort a landfill is to ask the people in it.',
  },
  {
    q: 'Can Google Analytics track TikTok, Instagram or podcast traffic?',
    a: 'Partly, and the part it misses is not a settings problem. Google Analytics can attribute any visit that arrives as a click carrying UTM parameters you added or a referrer the browser passed along — a tagged bio link works, and if you run one, tag it. It cannot attribute an exposure that produced no click: a podcast read, a video watched on Tuesday and acted on the following week, a screenshot in a group chat. Those people arrive later by searching your name, and GA4 books them as organic search or Direct, which is correct — search is where they clicked. The second limit is granularity. Where a referrer does survive it names the platform, not the post and not the account, and "TikTok" is not an answer when six ambassador accounts collapse into that one string. GA4 is not being wrong about any of this. It is answering "which visit", and a media budget is decided by "which exposure".',
  },
  {
    q: 'How do I tell how much traffic or how many signups ChatGPT sends me?',
    a: 'You can count the clicks, but the clicks are a floor rather than the number. Visits that arrive from an assistant with the referrer intact show up under its own domain (chatgpt.com, perplexity.ai) in your referrer report, and that report is worth reading. The larger path leaves nothing behind: the person reads your name in an answer, searches it, and arrives from Google, so even a perfect referrer header would book them against search. Crawler hits are not people either — GPTBot, ClaudeBot or PerplexityBot in your server logs mean a page was retrieved, and a retrieval is not a visitor. The remainder is only recoverable by asking, and the wording decides whether you recover it: "ChatGPT" as its own row beside Google, never an "AI assistant" category, because people remember the product they used and not the category it belongs to. Asking also gets you the thing no log could: point that row at a follow-up asking what they were looking for, and what comes back is real questions from people who then paid. /use-cases/ai-assistants carries the config.',
  },
  {
    q: 'What is self-reported attribution, and is it accurate?',
    a: 'Self-reported attribution is asking the customer where they heard about you and treating the answers as a measurement — one question, usually "how did you hear about us", asked inside a flow the person is already in, aggregated into channel shares. Its ceiling is worth stating plainly: it measures what somebody remembers and is willing to say, not what happened. People compress ("Google", when they first saw a video and searched afterwards), people forget, and a list nudges — options shown earlier are picked more often, which is a known survey-methodology effect and the reason order is randomized per respondent here and "I don\'t remember" is on screen rather than hidden behind a link. What it has that no log-based method has is coverage: it is the only instrument that reaches an exposure which produced no click. So the two are complements, not rivals — tagged links and channel consoles where they work, asking for the rest. And the error is measurable rather than arguable: keep one channel that has its own console in the list, and the ratio between what that console reports and what people self-report tells you how much self-reporting under-counts everything else. That coefficient is not computed for you yet — `calibration` comes back as an explicit null rather than as a smoothed guess.',
  },
  {
    q: 'How do I know which creator or which ambassador account drove a signup?',
    a: 'Three methods, and they fail in different places, so the choice is about which failure you can live with. A unique link or discount code per creator is exact when it is used and blind when it is not — somebody who saw the video, thought about it for a week and came back through search converts with no code, and creator audiences do that constantly, so codes under-count the channel they are meant to prove. A platform\'s own console covers the placements you bought through that platform and nothing that happened organically around them. Asking covers both and pays for it in memory: the person picks the platform, and the follow-up expands in place with your actual roster — avatar, display name and @handle together, because any of the three might be the one they recognize. Supply aliases too; they are matched and never displayed, and they exist because people remember descriptions ("the one who does the office skits") rather than handles. What comes back is the id you supplied, so resolving a description to a person stays your side of the line — and a free-text answer can be mapped onto a creator months later, retroactively, across every past month at once.',
  },
  {
    q: 'What is a good response rate for a "how did you hear about us" question?',
    a: 'We have not measured one, so we are not going to publish a benchmark — quoting an industry number we cannot show the working for would be a strange move for a product whose whole argument is that most attribution figures are confidently wrong. What can be said is which number to watch. It is not the completion rate: it is the share of signups that produced a usable channel answer, which is completion minus the people who answered "I don\'t remember" and the people who skipped. Both come back as their own buckets instead of being folded into a channel, so the subtraction is yours to do and nobody has quietly done it for you. Four things move that share, and all four are yours: where in the flow the question sits (early beats late, because asking late means asking only the people who stayed), whether answering is one tap or a text box, whether the list contains the channel the person actually used (a missing channel does not cost you one answer — its people pick something else, so you lose that channel and book a false entry against another), and whether the frame looks like your product or like somebody else\'s. Every share in the rollup ships next to the denominator it was computed over, so a small sample is visibly small. That is the part a benchmark would have hidden.',
  },
  {
    q: 'What does HumanSurvey measure that my analytics does not?',
    a: 'HumanSurvey measures the channels that arrive with no referrer. TikTok in-app, Instagram, a podcast, a Discord, a link pasted into a group chat, one person telling another, ChatGPT reading your name out in an answer — none of them hand your analytics a source, so all of them land in Direct / (not set) alongside people typing your domain from memory. Asking the person is the only always-on signal that survives that. It is worth having only if it goes deep enough to act on, which is why there is a second question: "TikTok" is not an answer when six ambassador accounts collapse into that one string, so the form expands in place and you get Jade, @jade.work0.',
  },
  {
    q: 'People make things up. Why would I trust a self-reported number?',
    a: 'Because HumanSurvey removes the bias that can be removed and shows you the part that cannot, rather than absorbing it. Candidate order is randomized per respondent by default, so no option sits at the top for everybody and the raw share is unbiased by construction — a tool that sorted options by media spend would keep confirming last month\'s budget. "I don\'t remember" is always on screen and skipping is allowed, and both come back as their own buckets instead of being folded into a channel to make the chart look decisive. Every share ships next to the denominator it was computed over. The thing that moves this from directional to a number you can plan against is a channel that already has ground truth: its own console reports the conversions it produced, and the ratio between that and what people self-report tells you how much self-reporting under-reports overall. That coefficient is not computed yet — `calibration` and `position_effect` come back as explicit nulls rather than as a smoothed guess.',
  },
  {
    q: 'Should I ask at signup, or after payment?',
    a: 'Both, and run them as two forms, because the two placements answer different questions. In the payment or upgrade flow the respondent is a paying customer, so the answer joins to revenue with no conversion plumbing at all, and the confirmation screen was dead space anyway. In the signup flow you see the people a channel sends who never pay — which is the judgment that kills a bad channel, and payment-only placement can never produce it. Run one in each and you can divide a channel\'s share of the paying population by its share of the signup population. Above 1 it converts better than your average, below 1 worse. Multiply that ratio by your overall signup-to-paid rate to get the channel\'s own rate — the ratio on its own is an index against your average, not a rate, and reading it as one is a mistake this site published before it caught it. Ask early within each flow: memory decays, and asking late means asking only the people who stayed, which systematically under-counts any channel whose users churn early.',
  },
  {
    q: 'Will it cost me conversion rate?',
    a: 'It is one tap on a list of logos, and skipping is allowed. The first pick is durable the moment it lands, so someone who answers "TikTok" and closes the tab has still told you their channel — the follow-up is a PATCH into the same response, not a second page, so nothing about the flow announces "one more screen". `theme` takes `accent`, `radius`, `font` and `dark_mode` so the frame does not look foreign inside your own checkout, which is what actually costs completion. What we will not do is make the question required: that converts people who genuinely do not remember into random pickers, which lowers data quality while appearing to raise completion.',
  },
  {
    q: 'Do I need to write code or JSON?',
    a: 'You describe the channels in a sentence and your agent writes the config and posts it — "list Google, ChatGPT, LinkedIn, TikTok and word of mouth, and for TikTok ask which of these three accounts". Nobody hand-maintains a candidate list: which creators you run changes monthly, and so does which channels earn the follow-up question, which is the decision only something that knows where this month\'s money went can make well. There is one piece of real engineering work, once: someone drops an iframe into your signup or payment page and passes your own user id as `external_id`. That is a few lines of host JavaScript — /docs#embed has the whole thing.',
  },
  {
    q: 'How do I get an API key?',
    a: 'Two calls and no browser. `POST /api/auth/code` mails a six-digit code to an address you control, and `POST /api/auth/verify` with `grant: "api_key"` exchanges it for an `hs_sk_...` key. That is the only time the key is readable — only its hash is stored — and signing in and signing up are the same act, so an address that has never been used gets an account. If your agent runs the MCP server (see the next answer for where that package stands), its `login` tool does the same round trip and writes the key to ~/.humansurvey/credentials instead of printing it, because a key that only exists in a transcript is a key that ends with the transcript. Afterwards: `GET /api/keys` lists every key on the account and `DELETE /api/keys/{id}` revokes any of them, including a leaked one you are not holding. The account owns the data and a key is only a credential pointing at it, so rotating one orphans nothing. /docs#authentication carries both calls in full.',
  },
  {
    q: 'Can I use the MCP server yet?',
    // Rendered with `whitespace-pre-line`, so the blank lines survive. This is the one
    // answer that carries two facts pointing opposite ways, and running them together in a
    // wall of text is how a reader comes away holding whichever half they read last.
    a:
      'Two halves to that, and this answer is where the site keeps them so every other page can point here instead of each carrying its own account.\n\n' +
      'In the repo: packages/mcp-server is on the 1.x line and speaks attribution — ten tools, verified end to end against the live API: `login`, `get_catalog`, `list_forms`, `get_form`, `create_form`, `configure_form`, `get_attribution`, `list_unresolved`, `remap`, `revoke_remap`. The pre-pivot five (`create_key`, `create_survey`, `get_results`, `list_surveys`, `close_survey`) are gone along with the endpoints they called.\n\n' +
      'On npm: `humansurvey-mcp` is published at 1.x, so `npx -y humansurvey-mcp` fetches a server whose ten tools match the current API. Versions below 1.0.0 are the pre-pivot build and call the deleted `/api/surveys` routes; they are deprecated on npm, but a pinned version or a stale lockfile will still resolve one, so pin `^1` if you pin at all.\n\n' +
      'Driving the REST endpoints directly stays equivalent — every tool is a thin wrapper over them, so nothing is out of reach either way.',
  },
  {
    q: 'How do the results come back to my agent?',
    a: 'Over REST, and the MCP tools wrap the same three reads. `GET /api/attribution/rollup?form_id=…` returns per-candidate counts and shares with the denominator they were computed over, plus the unresolved buckets (free text, "I don\'t remember", skipped) and the follow-up coverage read-outs. `GET /api/attribution/forms/{id}/responses?since_seq=…` is the cursor read: pass back the previous `next_cursor` and you get only the responses completed since, one row per person. `?external_id=…` on the same route looks up one identity, so attribution can be a property of a user record rather than a monthly report. It is structured data, not a PDF, so the agent writes the monthly channel note, resolves free text to a creator, or stamps the channel onto your own user rows.',
  },
  {
    q: 'Is there a dashboard I can log into?',
    a: 'No, and that is a decision rather than a gap. The aggregates are an API resource and your agent is the dashboard — it reads the rollup, writes the paragraph you actually wanted, and does the next thing. Accounts, keys and billing are the only things an account covers; configuration and results stay on the API, because a signed-in area that grows a candidate editor and a results table becomes exactly the dashboard-first product this one is trying not to be.',
  },
  {
    q: 'Are responses anonymous?',
    a: 'Yes, unless you deliberately make them otherwise. The respondent page collects nothing about the person: no name, no email, no ID, and no free-text question you could repurpose to ask for one. What can identify a response is what you send — `external_id`, whatever id your own product already uses for that user, passed in so answers can be joined back to your user table and to conversion events. Leave it out and the response is anonymous; pass it and it deliberately is not.',
  },
  {
    q: 'Can I close a form after a deadline or a response cap?',
    a: 'No, and that is deliberate rather than missing. `max_responses`, `expires_at` and `close_survey` are gone: an attribution form sits in a payment or signup flow for months, so it is a perpetual stream, not a bounded study. The only lifecycle left is `status: "active" | "paused"` via `PATCH /api/attribution/forms/{id}`, and pausing is reversible. Bounded windows moved to the read side — the rollup takes `from` and `to`, so you ask about a month instead of closing a form to end one.',
  },
  {
    q: 'Can I customize the look of the hosted form?',
    a: 'Within a fixed set of tokens, yes. `theme` accepts `accent`, `radius`, `font`, and `dark_mode` ("light" / "dark" / "auto"), set when you create the form or later with `PATCH /api/attribution/forms/{id}`. The reason is the embed: dropped into someone else\'s checkout, a form that looks foreign costs completion rate directly. What does not exist, and is not planned, is a theme editor or an HTML/CSS plugin surface — a bounded set of parameters is a requirement of the embed form factor; a GUI for authoring them is not.',
  },
  {
    q: 'What can HumanSurvey not tell me?',
    a: 'HumanSurvey cannot tell you what a person did — only what they say they remember, and no amount of tooling converts one into the other. It is first touch only, on purpose: last touch is near-constant (people search your brand name) and buys no media decision worth the completion rate a second framing costs. It sees no sessions, no pageviews and no paths, and it does not deduplicate against your traffic — one answer per person, given by that person. It is also not a form builder: one single-select question with one follow-up is the entire expressive range, and NPS, CSAT, post-event feedback and open-ended research were removed rather than hidden behind a plan. And it does not resolve identities: it renders the candidate list you supply and returns the id that was chosen, so matching "the one who does the office skits" to a person is your side of the line — a remap does that once, by hand, and then applies retroactively to every past month.',
  },
  {
    q: 'How is HumanSurvey different from Typeform, Google Forms, or SurveyMonkey?',
    a: 'Those are form builders and HumanSurvey is not one: a form builder lets a human design an arbitrary questionnaire in a UI, share a link, and read the answers in a dashboard. HumanSurvey asks one question, and the value is the machinery around it rather than the asking. Order randomized per respondent, so a share is not an artifact of the layout. Free text stored verbatim and remappable onto a creator months later, retroactively, without touching the responses. An `external_id` join, so channels sit next to revenue instead of next to sessions. Answers arriving as rows for an agent instead of as a page for a person. If somebody is going to read responses by hand, reach for a form builder — pasting a "how did you hear about us" question into one is genuinely the cheaper start. Reach for HumanSurvey when the answer has to be a monthly budget decision.',
  },
  {
    q: 'Is it free?',
    a: 'Open source, currently free to use for reasonable volumes. Long-term, billing attaches to the account — the email you verify to get a key — and the billable unit will be responses collected, on volume tiers rather than feature tiers, because feature gating forces an upgrade decision where volume gating just follows your growth. A response that answered the channel question and abandoned the follow-up counts: the channel is known, so it is real data. No surprise invoices — when pricing lands it will be announced up front.',
  },
  {
    q: 'I built against /api/surveys — what happened to it?',
    a: 'It was deleted, not deprecated, on 2026-07-30, when the product narrowed to attribution. The five question types, the Markdown syntax, the conditional-logic engine and the survey lifecycle went with it; `/api/attribution/*` replaces the endpoints and `/s/{id}` still works. Other things to check if you had integrated: the embed `submitted` postMessage payload changed shape and renamed `surveyId` to `formId`, and `POST /api/keys` now requires a verified email instead of minting keys to anyone who asks. The database was reset rather than migrated — the export taken first showed thirteen keys, all smoke tests or the owner\'s own demos, and no third-party user. The /changelog entry names every breaking change.',
  },
  {
    q: 'Where do I point my AI for complete technical details?',
    a: 'The human docs are at /docs. Machine-readable references: /api/openapi.json (OpenAPI 3), /llms.txt (short AI-first overview), /llms-full.txt (full AI-readable index, every field and status). For whether this fits a particular situation, the four walkthroughs are more use: /use-cases/ai-assistants, /use-cases/community-feedback, /use-cases/product-launch and /use-cases/events, each with a working config and the follow-up question that makes the answer specific.',
  },
]

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.a,
    },
  })),
}

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-[var(--page-gradient)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
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
              href="/docs"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Docs
            </Link>
          </div>
        </header>

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            FAQ
          </p>
          <h1 className="text-4xl tracking-[-0.02em] text-slate-950 sm:text-5xl">
            Where your signups come from, and how far to trust the answer.
          </h1>
          <p className="text-base leading-[1.7] text-slate-800">
            What a growth owner, a founder and the engineer who has to embed it ask
            before putting a &ldquo;how did you hear about us&rdquo; question into a
            signup or payment flow. The ones about Direct traffic, AI assistants and
            creator attribution are answered the same whether you end up using this or
            not.
          </p>
        </section>

        <section className="space-y-3">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-4 backdrop-blur-sm"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium leading-6 text-slate-900 [&::-webkit-details-marker]:hidden">
                <span>{f.q}</span>
                <span className="mt-1 shrink-0 font-mono text-xs text-[var(--accent)] transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-[1.7] text-slate-800">
                {f.a}
              </p>
            </details>
          ))}
        </section>

        <section className="space-y-3 border-t border-[var(--panel-border)] pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Still have questions?
          </p>
          <p className="text-sm leading-6 text-slate-700">
            Open an issue on{' '}
            <a
              href="https://github.com/sunsiyuan/human-survey/issues"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-slate-950"
            >
              GitHub
            </a>{' '}
            or read the{' '}
            <Link href="/docs" className="underline underline-offset-2 hover:text-slate-950">
              full docs
            </Link>
            .
          </p>
          <p className="text-sm leading-6 text-slate-700">
            <a
              href="/faq.md"
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
