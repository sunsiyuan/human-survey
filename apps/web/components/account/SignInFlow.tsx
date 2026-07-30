'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The whole sign-in flow: ask for an address, ask for the six digits mailed to it, land
 * on /account.
 *
 * One page and two states rather than two routes. The code is only useful within ten
 * minutes of the address being typed, so the two halves are one act — and a /signin/code
 * route would be a URL people bookmark, arrive at with no email in memory, and abandon.
 *
 * Every failure below is a real answer from POST /api/auth/code or POST /api/auth/verify
 * (lib/auth/otp.ts owns the rules). They are worth telling apart because the right next
 * move differs in each case: wait, retype, or ask for a fresh code. A single "something
 * went wrong" would leave the person guessing at all three.
 */

type Step = 'email' | 'code'

type Trouble = {
  /** The sentence the API returned, rendered verbatim — one wording, one owner. */
  message: string
  /** What to do about it. The API does not say, and it is the part that matters. */
  next?: string
  /**
   * True when the outstanding code is finished — expired, or its five attempts spent.
   * Nothing typed into the field can work, so the resend control becomes the primary
   * action instead of a footnote.
   */
  dead?: boolean
}

export function SignInFlow() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [trouble, setTrouble] = useState<Trouble | null>(null)
  const codeField = useRef<HTMLInputElement>(null)

  // Focus follows the step. Without it the person reads "we mailed you a code", tabs back
  // from their mail client, and types six digits into a page that is not listening.
  useEffect(() => {
    if (step === 'code') {
      codeField.current?.focus()
    }
  }, [step])

  async function requestCode() {
    setBusy(true)
    setTrouble(null)
    setSent(false)

    try {
      const response = await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (response.status === 202) {
        setCode('')
        setSent(true)
        setStep('code')
        return
      }

      const message = await errorMessage(response, 'Could not send the code')

      if (response.status === 429) {
        // Advance to the code step anyway. A 429 means codes have recently been issued,
        // so the most likely truth is that one is already sitting in this person's inbox
        // — and a throttle message on a screen with no code field to use it in is a dead
        // end. (The per-network cap can also fire for an address that got nothing, which
        // is why the way back to the email step stays visible.)
        setStep('code')
        setTrouble({
          message,
          next:
            'The ceiling is five codes an hour for one address and twenty for one network, so a shared office connection can trip it for you. A code you already asked for is good for ten minutes — try that one.',
        })
        return
      }

      setTrouble({ message })
    } catch {
      setTrouble({
        message: 'Could not reach humansurvey.co.',
        next: 'Check your connection and try again — nothing was sent.',
      })
    } finally {
      // finally, not a line per exit path: this function returns early on both the 202
      // and the 429, and a missed reset here leaves the code step's controls disabled
      // with no way back other than a reload.
      setBusy(false)
    }
  }

  async function submitCode() {
    setBusy(true)
    setTrouble(null)
    setSent(false)

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // grant defaults to a session server-side; naming it is how this stays readable
        // next to the MCP server, which posts the same route asking for 'api_key'.
        body: JSON.stringify({ email, code, grant: 'session' }),
      })

      if (response.ok) {
        // A full navigation, not router.push. The session cookie arrived on the response
        // we just read, and a client-side transition can serve /account out of a router
        // cache populated while signed out — which renders the signed-out redirect. One
        // extra page load, once per sign-in, buys certainty here.
        window.location.assign('/account')
        return
      }

      const body = (await response.json().catch(() => null)) as {
        error?: unknown
        reason?: unknown
      } | null

      const message = typeof body?.error === 'string' ? body.error : 'That code did not work'

      // `reason` rather than the sentence: expired and wrong-digits share a 400, and a UI
      // that branched on prose would silently start offering a retry field for a dead
      // code the first time someone rewords it.
      if (body?.reason === 'too_many_attempts') {
        setTrouble({
          message,
          next:
            'Five wrong guesses retires a code. Six digits is a small enough space to guess through, and that ceiling is the only thing making it safe — so this one is finished. Send another.',
          dead: true,
        })
      } else if (body?.reason === 'expired') {
        setTrouble({
          message,
          next: 'Codes last ten minutes. Send another and use it while you are here.',
          dead: true,
        })
      } else {
        setTrouble({
          message,
          next: 'Check the digits — you have five tries per code, then it has to be replaced.',
        })
      }
    } catch {
      setTrouble({
        message: 'Could not reach humansurvey.co.',
        next: 'Check your connection and try again.',
      })
    }

    // Reached only when the code did not work. The success path returned above and is
    // navigating, and re-enabling the button under a page that is already leaving reads
    // as "nothing happened" and invites a second submit against a consumed code.
    setBusy(false)
  }

  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] p-6 backdrop-blur-sm sm:p-8">
      {step === 'email' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy) {
              void requestCode()
            }
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="text-sm font-semibold text-slate-950">Email</span>
            <input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="mt-2 block w-full rounded-xl border border-[var(--panel-border)] bg-white/70 px-4 py-3 text-[15px] text-slate-950 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
          </label>

          <Trouble trouble={trouble} />

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-55"
          >
            {busy ? 'Sending…' : 'Email me a code'}
          </button>

          <p className="text-[13px] leading-6 text-slate-600">
            No password to set and none to forget. If this address has never signed in
            before, verifying the code creates the account — that is the whole sign-up.
          </p>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy && code.length === 6) {
              void submitCode()
            }
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="text-sm font-semibold text-slate-950">Six-digit code</span>
            <span className="mt-1 block text-[13px] leading-6 text-slate-600">
              {sent ? 'Sent to ' : 'Check '}
              <strong className="font-medium text-slate-900">{email}</strong>
              {sent ? '. It is in the subject line too.' : ' for it.'}
            </span>
            <input
              ref={codeField}
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              // Digits only, six of them, stripped rather than rejected: codes get pasted
              // out of mail clients that bring a space or a stray character with them.
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="mt-3 block w-full rounded-xl border border-[var(--panel-border)] bg-white/70 px-4 py-3 font-mono text-2xl tracking-[0.35em] text-slate-950 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
          </label>

          <Trouble trouble={trouble} />

          {/* Deliberately no auto-submit on the sixth digit. An attempt is a scarce
              resource here — five per code — and spending one on a half-typed paste is a
              cost the person did not agree to. */}
          <button
            type="submit"
            disabled={busy || code.length !== 6 || trouble?.dead === true}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-55"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            <button
              type="button"
              disabled={busy}
              onClick={() => void requestCode()}
              className={`underline decoration-dotted underline-offset-4 disabled:opacity-55 ${
                trouble?.dead
                  ? 'font-semibold text-slate-950'
                  : 'text-[var(--accent-strong)] hover:text-slate-900'
              }`}
            >
              Send another code
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep('email')
                setCode('')
                setTrouble(null)
                setSent(false)
              }}
              className="text-slate-600 underline decoration-dotted underline-offset-4 hover:text-slate-900 disabled:opacity-55"
            >
              Use a different address
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function Trouble({ trouble }: { trouble: Trouble | null }) {
  if (!trouble) {
    return null
  }

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-[13px] leading-6"
    >
      <p className="font-semibold text-slate-950">{trouble.message}</p>
      {trouble.next ? <p className="mt-1 text-slate-700">{trouble.next}</p> : null}
    </div>
  )
}

/**
 * Prefer the server's own sentence, fall back to one of ours.
 *
 * A 500 from the mail provider or a proxy can arrive as HTML, so the parse has to be
 * allowed to fail without turning into an unhandled rejection inside a submit handler.
 */
async function errorMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null

  return typeof body?.error === 'string' && body.error ? body.error : fallback
}
