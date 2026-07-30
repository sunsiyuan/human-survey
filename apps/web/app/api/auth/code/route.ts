import { NextResponse } from 'next/server'

import { issueLoginCode, RateLimitedError } from '@/lib/auth/otp'
import { EmailError } from '@/lib/email'

/**
 * POST /api/auth/code — mail a six-digit sign-in code.
 *
 * Public and unauthenticated by necessity: it is the front door. The throttles live in
 * lib/auth/otp.ts.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim() : ''

  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  try {
    await issueLoginCode(email, clientIp(request))
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json({ error: error.message }, { status: 429 })
    }

    if (error instanceof EmailError) {
      return NextResponse.json({ error: 'Could not send the code' }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Always the same body on success. Saying whether the address is already registered
  // would turn this endpoint into a way to test whether someone has an account.
  return NextResponse.json({ sent: true, expires_in_seconds: 600 }, { status: 202 })
}

/**
 * Deliberately loose. Strict email regexes reject valid addresses far more often than
 * they catch invalid ones, and the real validation is whether a code arrives.
 */
function isPlausibleEmail(value: string) {
  return value.length >= 3 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Client IP for the issuance throttle.
 *
 * Takes the FIRST entry of x-forwarded-for, which on Vercel is the real client — the
 * platform appends, so the last entry is the proxy. Reading the last one, or trusting
 * a caller-supplied header on a platform that does not overwrite it, turns the
 * throttle into something an attacker sets themselves.
 *
 * Returns null rather than a placeholder when there is no header, and the throttle
 * skips the IP check in that case: a shared bucket for every unidentifiable caller
 * would let one of them lock out all the others.
 */
function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')

  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()

    if (first) {
      return first.slice(0, 64)
    }
  }

  return request.headers.get('x-real-ip')?.trim().slice(0, 64) ?? null
}
