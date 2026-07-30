import { NextResponse } from 'next/server'

import { createApiKey, createSession, SESSION_COOKIE } from '@/lib/auth'
import { verifyLoginCode, type VerifyFailure } from '@/lib/auth/otp'

/**
 * POST /api/auth/verify — exchange a six-digit code for a credential.
 *
 * Two grants from one mechanism (docs/design/attribution-pivot.md §10.2):
 *
 *   grant: 'session'  → sets an httpOnly cookie. The browser path.
 *   grant: 'api_key'  → returns a key. The MCP path — the server writes it straight
 *                       to its local config, so it never enters an agent transcript.
 *
 * The second grant is the entire reason this is a code rather than a magic link: a
 * link needs a browser and a way to get the result back to the process that started
 * the flow, whereas six digits can be read aloud.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown
    code?: unknown
    grant?: unknown
    name?: unknown
    agent_client?: unknown
  } | null

  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const grant = body?.grant === 'api_key' ? 'api_key' : 'session'

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'email and a six-digit code are required' }, { status: 400 })
  }

  let result

  try {
    result = await verifyLoginCode(email, code)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (!result.ok) {
    const { status, error, reason } = FAILURES[result.reason]
    return NextResponse.json({ error, reason }, { status })
  }

  if (grant === 'api_key') {
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined
    const agentClient = typeof body?.agent_client === 'string' ? body.agent_client.trim() : undefined
    const { id, key } = await createApiKey(result.accountId, name || 'default', agentClient)

    // The only time the key is ever readable. Nothing stores it in the clear.
    return NextResponse.json({ id, key }, { status: 201 })
  }

  const { token, maxAge } = await createSession(result.accountId)
  const response = NextResponse.json({ signed_in: true }, { status: 200 })

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })

  return response
}

/**
 * `bad_code` and `no_code` deliberately return the same message AND the same reason.
 * Distinguishing them tells an attacker whether an address has a code outstanding, which
 * is a free signal about whether someone is mid-sign-in.
 *
 * `reason` exists so /signin can tell "wrong digits, try again" from "this code is dead,
 * ask for another" without matching on the prose above. The two share a status code, so
 * the alternative is a UI branch that breaks silently — still rendering a retry field for
 * a code that can never work again — the next time somebody rewords a sentence.
 */
const FAILURES: Record<
  VerifyFailure,
  { status: number; error: string; reason: 'invalid' | 'expired' | 'too_many_attempts' }
> = {
  no_code: { status: 400, error: 'That code is not valid', reason: 'invalid' },
  bad_code: { status: 400, error: 'That code is not valid', reason: 'invalid' },
  expired: {
    status: 400,
    error: 'That code has expired — request a new one',
    reason: 'expired',
  },
  too_many_attempts: {
    status: 429,
    error: 'Too many incorrect attempts — request a new code',
    reason: 'too_many_attempts',
  },
}
