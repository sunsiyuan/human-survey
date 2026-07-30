'use client'

import { useState } from 'react'

/**
 * The install affordance, kept but demoted: the headline talks to the buyer, and this
 * talks to whoever pastes the config. Both tabs carry the key inline, because the whole
 * human part of setup is moving a key from one place to another — a config that omits it
 * looks like it works and then does not.
 */

type Tab = 'claudecode' | 'config'

const CLAUDE_CODE_CMD =
  'claude mcp add humansurvey --env HUMANSURVEY_API_KEY=hs_sk_... -- npx -y humansurvey-mcp'

const MCP_CONFIG = `{
  "mcpServers": {
    "humansurvey": {
      "command": "npx",
      "args": ["-y", "humansurvey-mcp"],
      "env": { "HUMANSURVEY_API_KEY": "hs_sk_..." }
    }
  }
}`

export function InstallPanel() {
  const [tab, setTab] = useState<Tab>('claudecode')
  const [copied, setCopied] = useState(false)

  const content = tab === 'claudecode' ? CLAUDE_CODE_CMD : MCP_CONFIG

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--code-surface)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab('claudecode')}
            className={`rounded-md px-3 py-1 font-mono text-[11px] transition ${
              tab === 'claudecode'
                ? 'bg-white/10 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Claude Code
          </button>
          <button
            type="button"
            onClick={() => setTab('config')}
            className={`rounded-md px-3 py-1 font-mono text-[11px] transition ${
              tab === 'config' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Any MCP client
          </button>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="font-mono text-[11px] text-slate-500 transition hover:text-slate-200"
        >
          {copied ? 'copied!' : 'copy'}
        </button>
      </div>

      <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-6 text-[var(--accent-fg)]">
        {content}
      </pre>

      {tab === 'config' && (
        <p className="border-t border-white/10 px-5 py-3 font-mono text-[11px] text-slate-500">
          Claude Desktop reads{' '}
          <code className="text-slate-400">
            ~/Library/Application Support/Claude/claude_desktop_config.json
          </code>
        </p>
      )}

      {/* The state of the package, next to the command that installs it, because a visitor
          who ran that command and wondered why every tool fails deserves to have read it
          here first.

          Kept to two sentences and a link on purpose. The full version — which nine tools,
          which five went away, what to do meanwhile — lives in one answer on /faq, and this
          panel points at it rather than restating it. Five surfaces each carrying their own
          account of the npm/repo split is how two of them ended up wrong in opposite
          directions, and the one that goes stale first is always the one nobody re-reads. */}
      <p className="border-t border-white/10 px-5 py-3 text-[12px] leading-5 text-slate-500">
        Status: <code className="text-slate-400">1.0.0</code>, which speaks attribution, is
        built and verified but not published — so npm still serves{' '}
        <code className="text-slate-400">0.6.0</code> and the command above fetches it. Until
        the publish lands, build it from the{' '}
        <a
          href="https://github.com/sunsiyuan/human-survey"
          target="_blank"
          rel="noreferrer"
          className="text-slate-300 underline underline-offset-2"
        >
          repo
        </a>{' '}
        or drive the{' '}
        <a href="/docs#api-reference" className="text-slate-300 underline underline-offset-2">
          REST endpoints
        </a>{' '}
        the tools wrap.{' '}
        <a href="/faq" className="text-slate-300 underline underline-offset-2">
          Where this stands, in full
        </a>
        .
      </p>
    </div>
  )
}
