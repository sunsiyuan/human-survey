'use client'

import { useEffect, useState } from 'react'

/**
 * Keys: list, issue, revoke. The entire interactive surface of the account area.
 *
 * The valuable moment on this page is the one right after a key is minted, when the
 * plaintext exists in this component's state and nowhere else in the world. Everything is
 * arranged around getting it from here into an MCP config in one action, because that is
 * where the human's job ends and the agent's begins — and because the alternative is the
 * failure this design was built to stop: a key that lives only in a transcript.
 *
 * Reads GET /api/keys rather than being handed rows by the server component. One shape,
 * one place: the page would otherwise hold a second copy of the list query that drifts
 * from the endpoint the agent sees. It also means every date below renders client-side,
 * where a locale-dependent format cannot disagree with server HTML.
 */

type ApiKey = {
  id: string
  name: string | null
  /** Set when the key came from the MCP `login` tool — the client that asked for it. */
  agent_client: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

/**
 * GET /api/keys also returns `current`, flagging the key that authenticated the request.
 * Not modelled and not rendered: this page authenticates with a session cookie, so no key
 * authenticated anything and the flag is false on every row. Showing it would invent a
 * distinction — "this is the one you are using" — that is meaningless in a browser and
 * actively misleading next to a revoke button.
 */

type Issued = {
  id: string
  key: string
  name: string | null
}

type Phase = 'loading' | 'ready' | 'failed'

export function Keys() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [name, setName] = useState('')
  const [issued, setIssued] = useState<Issued | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    let live = true

    async function load() {
      try {
        const response = await fetch('/api/keys', { credentials: 'same-origin' })

        if (response.status === 401) {
          // The session died between the server render and this fetch. Bouncing is safe
          // here and only here: on mount there is no minted key on screen to destroy.
          // The mutation handlers below deliberately do not navigate for the same reason.
          window.location.assign('/signin')
          return
        }

        if (!response.ok) {
          throw new Error(await errorMessage(response, 'Could not load your keys'))
        }

        const rows = (await response.json()) as ApiKey[]

        if (live) {
          setKeys(rows)
          setPhase('ready')
        }
      } catch (failure) {
        if (live) {
          setError(failure instanceof Error ? failure.message : 'Could not load your keys')
          setPhase('failed')
        }
      }
    }

    void load()

    return () => {
      live = false
    }
  }, [])

  async function issue() {
    setBusy(true)
    setError(null)

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null }),
      })

      if (!response.ok) {
        throw new Error(await errorMessage(response, 'Could not issue a key'))
      }

      const body = (await response.json()) as {
        id: string
        key: string
        name: string | null
        created_at: string
      }

      setIssued({ id: body.id, key: body.key, name: body.name })
      setName('')
      // Prepended from the POST's own response instead of re-fetching the list. A refetch
      // that failed — an expired session, a dropped connection — would leave the new row
      // invisible while the only readable copy of the key sat in state above it, and the
      // obvious recovery (reload) is exactly what destroys it. The server already told us
      // everything a fresh key's row contains.
      setKeys((current) => [
        {
          id: body.id,
          name: body.name,
          agent_client: null,
          created_at: body.created_at,
          last_used_at: null,
          revoked_at: null,
        },
        ...current,
      ])
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not issue a key')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setBusy(true)
    setError(null)

    try {
      const response = await fetch(`/api/keys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })

      if (response.status !== 204) {
        throw new Error(await errorMessage(response, 'Could not revoke that key'))
      }

      // Stamped locally rather than refetched, for the same reason as above. The server
      // returned 204, so the row is revoked; the exact timestamp is cosmetic and the next
      // load will replace this one with the real value.
      setKeys((current) =>
        current.map((key) =>
          key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key,
        ),
      )
      setConfirming(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not revoke that key')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {issued ? <NewKey issued={issued} onDismiss={() => setIssued(null)} /> : null}

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] p-6 backdrop-blur-sm">
        <h2 className="text-base font-semibold text-slate-950">Issue a key</h2>
        <p className="mt-2 text-[13px] leading-6 text-slate-600">
          One per place you paste it — the name is how you tell them apart later, when one
          of them has to be revoked and the others must keep working.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy) {
              void issue()
            }
          }}
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="text"
            value={name}
            maxLength={64}
            onChange={(event) => setName(event.target.value)}
            placeholder="claude-desktop"
            aria-label="Key name"
            className="min-w-0 flex-1 rounded-xl border border-[var(--panel-border)] bg-white/70 px-4 py-3 text-[15px] text-slate-950 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-slate-800 disabled:opacity-55"
          >
            {busy ? 'Working…' : 'Issue a key'}
          </button>
        </form>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-[13px] leading-6 text-slate-900"
        >
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">Your keys</h2>

        {phase === 'loading' ? <p className="text-[13px] text-slate-600">Loading…</p> : null}

        {/* Said explicitly, because the alternative is a heading with nothing under it —
            which reads as "you have no keys" and invites issuing a duplicate of one that
            is sitting right there unlisted. */}
        {phase === 'failed' ? (
          <p className="text-[13px] leading-6 text-slate-600">
            The list did not load, so this is not a statement that you have no keys. Reload the
            page.
          </p>
        ) : null}

        {phase === 'ready' && keys.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--panel-border)] px-5 py-6 text-[13px] leading-6 text-slate-600">
            No keys yet. Issue one above, paste the config it gives you into your MCP client,
            and then tell your agent what channels you run — it does the rest.
          </p>
        ) : null}

        {keys.map((key) => (
          <KeyRow
            key={key.id}
            apiKey={key}
            busy={busy}
            confirming={confirming === key.id}
            onAskConfirm={() => setConfirming(key.id)}
            onCancel={() => setConfirming(null)}
            onRevoke={() => void revoke(key.id)}
          />
        ))}
      </section>
    </div>
  )
}

function KeyRow({
  apiKey,
  busy,
  confirming,
  onAskConfirm,
  onCancel,
  onRevoke,
}: {
  apiKey: ApiKey
  busy: boolean
  confirming: boolean
  onAskConfirm: () => void
  onCancel: () => void
  onRevoke: () => void
}) {
  const revoked = apiKey.revoked_at !== null

  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 rounded-2xl border border-[var(--panel-border)] px-5 py-4 ${
        revoked ? 'bg-[var(--surface-muted)]/60' : 'bg-[var(--surface)]'
      }`}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-2">
          <span
            className={`text-[15px] font-medium ${revoked ? 'text-slate-500 line-through' : 'text-slate-950'}`}
          >
            {apiKey.name ?? 'Unnamed key'}
          </span>
          <span className="font-mono text-[11px] text-slate-500">{apiKey.id}</span>
          {revoked ? (
            <span className="rounded-full bg-slate-900/8 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              revoked
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-[12px] leading-5 text-slate-600">
          Issued {day(apiKey.created_at)}
          {' · '}
          {/* Last used is the only feedback that tells someone whether the config they
              pasted actually works. It is also the whole of it — what the key then did is
              the agent's to report, not this page's. */}
          {apiKey.last_used_at ? `last used ${day(apiKey.last_used_at)}` : 'never used'}
          {apiKey.revoked_at ? ` · revoked ${day(apiKey.revoked_at)}` : ''}
          {apiKey.agent_client ? ` · issued to ${apiKey.agent_client}` : ''}
        </p>
      </div>

      {revoked ? null : confirming ? (
        <span className="flex items-center gap-3 text-[13px]">
          <button
            type="button"
            disabled={busy}
            onClick={onRevoke}
            className="font-semibold text-red-700 underline decoration-dotted underline-offset-4 hover:text-red-900 disabled:opacity-55"
          >
            Revoke for good
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
        </span>
      ) : (
        // Two taps, because there is no undo. Revoking is instant and permanent, and
        // anything using that key stops working the moment it lands.
        <button
          type="button"
          onClick={onAskConfirm}
          className="text-[13px] text-slate-600 underline decoration-dotted underline-offset-4 hover:text-slate-900"
        >
          Revoke
        </button>
      )}
    </div>
  )
}

/**
 * The once-only panel.
 *
 * It shows the key, and immediately under it the config that key belongs in. That order is
 * the point: the useful action is not "copy a secret", it is "finish the install", and a
 * panel that stopped at the secret leaves the person to go and find the snippet somewhere
 * else while the only copy of the key sits in a tab they must not close.
 */
function NewKey({ issued, onDismiss }: { issued: Issued; onDismiss: () => void }) {
  const [tab, setTab] = useState<'claudecode' | 'config'>('claudecode')
  const snippet = tab === 'claudecode' ? claudeCodeCommand(issued.key) : mcpConfig(issued.key)

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--accent)]/45 bg-[var(--surface)] p-6 shadow-[0_28px_90px_-70px_rgba(14,23,38,0.5)]">
      <div>
        <h2 className="text-base font-semibold text-slate-950">
          {issued.name ? `“${issued.name}” is ready.` : 'Your key is ready.'} Copy it now.
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-slate-700">
          This is the only time it can be read. Only a SHA-256 hash of it is stored, so
          nobody — including us — can show it to you again. If it goes missing, issue
          another and revoke this one: your forms and answers belong to the account, not to
          the key, so nothing is orphaned by replacing it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--code-surface)] px-4 py-3">
        <code className="min-w-0 flex-1 font-mono text-[13px] break-all text-[var(--accent-fg)]">
          {issued.key}
        </code>
        <CopyButton value={issued.key} label="copy key" />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--code-surface)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="flex gap-1">
            {(
              [
                ['claudecode', 'Claude Code'],
                ['config', 'Any MCP client'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`rounded-md px-3 py-1 font-mono text-[11px] transition ${
                  tab === value ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <CopyButton value={snippet} label="copy config" />
        </div>
        <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-6 text-[var(--accent-fg)]">
          {snippet}
        </pre>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <a
          href="/docs#mcp-tools"
          className="text-[var(--accent-strong)] underline decoration-dotted underline-offset-4 hover:text-slate-900"
        >
          What your agent can do with it
        </a>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-600 underline decoration-dotted underline-offset-4 hover:text-slate-900"
        >
          I have copied it — hide the key
        </button>
      </div>
    </section>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')

  function copy() {
    // clipboard is undefined on an insecure origin and writeText rejects when the
    // permission is denied. Both have to say so: a copy button that silently does nothing
    // is how a config gets pasted with an empty key in it.
    if (!navigator.clipboard) {
      setState('failed')
      return
    }

    navigator.clipboard.writeText(value).then(
      () => {
        setState('done')
        setTimeout(() => setState('idle'), 1500)
      },
      () => setState('failed'),
    )
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="font-mono text-[11px] whitespace-nowrap text-slate-400 transition hover:text-slate-100"
    >
      {state === 'done' ? 'copied!' : state === 'failed' ? 'select it by hand' : label}
    </button>
  )
}

/**
 * The two install shapes, with the key already in them.
 *
 * Kept in step with components/home/InstallPanel.tsx and the /docs install section by
 * hand — they are the same two lines with a placeholder where this one has the real
 * value. HUMANSURVEY_API_KEY is the name packages/mcp-server reads (src/credentials.ts);
 * renaming it here produces a config that looks right and finds no key.
 */
function claudeCodeCommand(key: string) {
  return `claude mcp add humansurvey --env HUMANSURVEY_API_KEY=${key} -- npx -y humansurvey-mcp`
}

function mcpConfig(key: string) {
  return `{
  "mcpServers": {
    "humansurvey": {
      "command": "npx",
      "args": ["-y", "humansurvey-mcp"],
      "env": { "HUMANSURVEY_API_KEY": "${key}" }
    }
  }
}`
}

/**
 * Client-only rendering, so a locale-dependent format cannot desync from server HTML —
 * this component fetches its rows after mount and there is no server pass to disagree
 * with.
 */
function day(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

async function errorMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null

  return typeof body?.error === 'string' && body.error ? body.error : fallback
}
