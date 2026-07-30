import { NextResponse } from 'next/server'

import { destroySession, readSessionCookie, SESSION_COOKIE } from '@/lib/auth'

/**
 * POST /api/auth/signout — end the browser session.
 *
 * Deletes the row, not just the cookie. A cookie-only sign-out leaves a live token in
 * the sessions table for the remainder of its thirty days, so "sign out" on a borrowed
 * laptop would revoke nothing that a copy of the cookie could still replay — which is
 * the one scenario anybody clicks it for.
 *
 * POST only, deliberately. A sign-out reachable by GET is a URL that link prefetchers,
 * mail scanners and corporate proxies all follow on their own, and the symptom is people
 * being signed out at random with nothing in the logs that looks like a cause.
 *
 * Idempotent: no cookie, an unknown token and an expired one all clear and return 200.
 * A sign-out that can fail because you were already signed out is a dead end for someone
 * whose only goal is to not be signed in.
 */
export async function POST(request: Request) {
  const token = readSessionCookie(request)

  let deleted = true
  let message: string | null = null

  try {
    await destroySession(token)
  } catch (error) {
    deleted = false
    message = error instanceof Error ? error.message : 'Database error'
  }

  // The cookie goes regardless of whether the row went with it. Returning 500 with the
  // session still attached would leave the person in front of the machine signed in,
  // which is the worse half of this failure; the reachable-but-broken database is the
  // one we can report and cannot fix from here.
  const response = deleted
    ? NextResponse.json({ signed_out: true }, { status: 200 })
    : NextResponse.json({ signed_out: true, session_deleted: false, error: message }, { status: 500 })

  // path must match the path the cookie was set with (/), or the browser keeps the
  // original alongside this expired one and the session survives the sign-out.
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return response
}
