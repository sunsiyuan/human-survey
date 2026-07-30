import { NextResponse } from 'next/server'

import { createApiKey, requireAccount } from '@/lib/auth'
import { sql } from '@/lib/db'

/**
 * Key management, now scoped to an account.
 *
 * Two things changed with the pivot (docs/design/attribution-pivot.md §10):
 *
 * 1. POST is no longer public. It used to mint a key to anyone who asked, which made
 *    the frictionless first run possible and made recovery impossible — the resulting
 *    key was the sole proof of ownership of everything it went on to create, and it
 *    usually ended its life in an agent transcript. Keys are now issued only against a
 *    verified email code (POST /api/auth/verify) or an existing key.
 * 2. GET lists every key on the account rather than only the one presented. A key that
 *    can see only itself cannot be rotated without losing whatever it owned.
 *
 * requireAccount, not requireAuth: these are the routes /account drives, and a browser
 * arriving there has a session cookie and no key — a key-only contract makes the page
 * that exists to hand out the first key the one page that cannot. Bearer callers are
 * unaffected down to the 401 body; see lib/auth.ts.
 */

export async function POST(request: Request) {
  const auth = await requireAccount(request)
  if (auth instanceof Response) {
    return auth
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    agent_client?: unknown
  } | null

  const name = typeof body?.name === 'string' ? body.name.trim() || null : null
  const agentClient = typeof body?.agent_client === 'string' ? body.agent_client.trim() || null : null

  try {
    const { id, key } = await createApiKey(auth.accountId, name ?? undefined, agentClient ?? undefined)

    return NextResponse.json({ id, key, name, created_at: new Date().toISOString() }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await requireAccount(request)
  if (auth instanceof Response) {
    return auth
  }

  try {
    const rows = (await sql`
      SELECT id, name, agent_client, created_at, last_used_at, revoked_at
      FROM api_keys
      WHERE account_id = ${auth.accountId}
      ORDER BY created_at DESC
    `) as Array<{
      id: string
      name: string | null
      agent_client: string | null
      created_at: string
      last_used_at: string | null
      revoked_at: string | null
    }>

    // Flagging which one is in use makes "revoke the leaked key" a safe operation to
    // perform from a list, instead of a guess about which row is the caller.
    //
    // A session-authenticated caller has no key in play, so keyId is null and every row
    // comes back current:false. That is the honest answer rather than a degraded one —
    // nothing about a cookie identifies one of these keys — and it is why /account does
    // not render the flag at all.
    return NextResponse.json(rows.map((row) => ({ ...row, current: row.id === auth.keyId })))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
