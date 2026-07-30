import { InstallPanel } from './InstallPanel'

/**
 * §11's second beat: the embed collects the answers, the agent keeps the candidate list
 * current. Named rather than led with — the headline is for whoever has to decide this
 * measures something they cannot currently measure, and installing an MCP server is not
 * that decision.
 *
 * The one thing this section must not do is imply a dashboard. /signin and /account exist
 * and are exactly two pages wide — you sign in to be handed a key, and that is the whole of
 * the signed-in area. The config arrives over the API and the monthly read is a sentence to
 * an agent; there is no results screen to browse, and there is not going to be one.
 */

export function Setup() {
  return (
    <section id="setup" className="space-y-6">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          Setup
        </p>
        <h2 className="font-display text-3xl tracking-[-0.015em] text-slate-950 sm:text-4xl">
          Hand your agent a key. That is your half.
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
          Nobody hand-writes a candidate list — your agent does, from what you tell it in a
          sentence. Which channels you run changes monthly, and so does which of them
          deserve the follow-up question, so the configuration is a thing an agent
          maintains rather than a thing you fill in once.
        </p>
      </div>

      <ol className="space-y-4">
        <li className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-[var(--accent)]">01</span>
            <h3 className="text-base font-semibold text-slate-950">Get a key</h3>
          </div>
          <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-700">
            A six-digit code to an address you control, then one call to exchange it — no
            browser needed, and no anonymous keys. Or tell your agent to run its{' '}
            <code className="font-mono text-[13px]">login</code> tool: it does the round trip
            and writes the key to a file on your machine instead of printing it into the
            conversation. Transcripts end, which is how keys get lost.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href="/signin"
              className="inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--accent-strong)] px-4 text-[13px] font-medium text-[var(--accent-fg)] transition hover:bg-slate-900"
            >
              Get a key
            </a>
            <a
              href="/docs#authentication"
              className="text-[13px] text-[var(--accent-strong)] underline decoration-dotted underline-offset-4 hover:text-slate-900"
            >
              The two calls, in full
            </a>
          </div>
        </li>

        <li className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-[var(--accent)]">02</span>
            <h3 className="text-base font-semibold text-slate-950">
              Paste it into your MCP config
            </h3>
          </div>
          <div className="mt-3">
            <InstallPanel />
          </div>
        </li>

        <li className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-5 py-5 backdrop-blur-sm">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-[var(--accent)]">03</span>
            <h3 className="text-base font-semibold text-slate-950">
              Say what you run and where it goes
            </h3>
          </div>
          <blockquote className="mt-3 max-w-3xl border-l-2 border-[var(--accent)]/40 pl-4 text-[14px] leading-6 text-slate-900">
            &ldquo;Set up attribution for my checkout page. My channels are Google, ChatGPT,
            LinkedIn, TikTok and word of mouth, and for TikTok ask which of these three
            accounts: @jade.work0, @transyncai_tom, @nico.translate.&rdquo;
          </blockquote>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-700">
            Your agent reads the platform catalog, creates the form, writes the candidate
            lists and hands back a URL to embed. A month later:{' '}
            <em>&ldquo;how did last month look?&rdquo;</em> — and, in the same breath, the
            three ambassadors you just signed get their own rows and the channels that stopped
            earning their follow-up lose it.
          </p>
        </li>
      </ol>
    </section>
  )
}
