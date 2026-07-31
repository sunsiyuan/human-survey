'use client'

import Link from 'next/link'
import { useState } from 'react'

/**
 * The buyer's half of the hero.
 *
 * Resend's hero shows four lines of TypeScript because every visitor already knows what an
 * email is, so the only open question is how much work sending one will be. Nobody arrives
 * here knowing what the payload looks like, which is why this pane sits beside the picker
 * rather than alone — and why the two are labelled whose screen is whose. Show only this and
 * "ask people how they heard about you" reads as a form you could build tonight; show only
 * the picker and the whole thing reads as a form builder, which is the misfiling the pivot
 * deleted a product to escape.
 *
 * What this pane shows is an ENGLISH SENTENCE, not the install command. That is the actual
 * shape of the work for this buyer: they sign up, hand a key to their agent, and describe
 * the channels they spend money on. They will not write the config, and showing them one
 * would advertise a job they are not going to do.
 *
 * ON THE SURFACE COLOUR. This was briefly a dark terminal panel in Claude's own palette. It
 * was wrong twice. It made the loudest element on the page the most technical-looking one,
 * for a buyer likelier to come from marketing than engineering — and what it contains is a
 * sentence in English, so a code surface mis-signals what is being asked of them. It also
 * put a second brand's colour on our own hero. It is the site's card now: same surface,
 * same border, same green as everything else here. Only the install line, which really is a
 * command, keeps a monospace inset.
 */

const SPOKEN =
  'Set up attribution for my checkout. Channels are Google, ChatGPT, LinkedIn, TikTok and ' +
  'word of mouth — for TikTok, ask which of @jade.work0, @diego.conversa, @nico.translate.'

const INSTALL =
  'claude mcp add humansurvey --env HUMANSURVEY_API_KEY=hs_sk_... -- npx -y humansurvey-mcp'

export function AgentPrompt() {
  const [copied, setCopied] = useState<'spoken' | 'install' | null>(null)

  function copy(what: 'spoken' | 'install') {
    navigator.clipboard.writeText(what === 'spoken' ? SPOKEN : INSTALL).then(() => {
      setCopied(what)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)] px-4 py-2.5">
        <span className="font-mono text-[11px] text-[var(--accent)]">You, to Claude Code</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copy('spoken')}
            className="rounded-md px-2 py-1 font-mono text-[11px] text-stone-500 transition hover:text-stone-900"
          >
            {copied === 'spoken' ? 'copied' : 'copy'}
          </button>
          {/* Beside the copy control, not at the top of the page. Copying the sentence is
              the moment the next step becomes obvious, and the next step needs a key. */}
          <Link
            href="/signin"
            className="inline-flex min-h-7 items-center justify-center rounded-full bg-[var(--accent-strong)] px-3 text-[11px] font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            Get a key
          </Link>
        </div>
      </div>

      <p className="px-5 py-5 text-[15px] leading-7 text-stone-800">&ldquo;{SPOKEN}&rdquo;</p>

      <div className="border-t border-[var(--panel-border)] bg-[var(--surface-muted)] px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-stone-600">once, to install</span>
          <button
            type="button"
            onClick={() => copy('install')}
            className="font-mono text-[11px] text-stone-600 transition hover:text-stone-900"
          >
            {copied === 'install' ? 'copied' : 'copy'}
          </button>
        </div>
        {/* overflow-x on the line itself, never on the page: a long command inside a grid
            item whose automatic minimum is min-content would otherwise widen the document
            and give the whole page a horizontal scrollbar on a phone. */}
        <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-5 text-stone-600">
          <code>{INSTALL}</code>
        </pre>
      </div>

      <p className="border-t border-[var(--panel-border)] px-5 py-3 text-[12px] leading-5 text-stone-600">
        npm: <code className="text-stone-800">humansurvey-mcp</code> on the{' '}
        <code className="text-stone-800">1.x</code> line · ten tools · MIT ·{' '}
        <a href="/faq" className="text-[var(--accent)] underline underline-offset-2">
          where this stands
        </a>
      </p>
    </div>
  )
}
