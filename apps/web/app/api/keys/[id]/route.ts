import { NextResponse } from 'next/server'

import { requireAccount } from '@/lib/auth'
import { sql } from '@/lib/db'

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/keys/{id} — revoke a key.
 *
 * Any key on the account may now revoke any other, where previously a key could only
 * revoke itself. That restriction existed because the key WAS the identity, and it
 * made the one case that matters — "a key leaked, kill it from somewhere safe" —
 * impossible without also using the leaked key.
 *
 * Still a soft delete. The account's data does not hang off the key any more, but
 * keeping the row preserves the audit trail of what was issued and when.
 *
 * A browser session is an accepted credential here (requireAccount, see lib/auth.ts).
 * That is the somewhere-safe: revoking a leaked key from /account needs no second key,
 * only the email address that owns the account.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAccount(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id } = await context.params

  try {
    const rows = (await sql`
      UPDATE api_keys
      SET revoked_at = now()
      WHERE id = ${id}
        AND account_id = ${auth.accountId}
        AND revoked_at IS NULL
      RETURNING id
    `) as Array<{ id: string }>

    if (rows.length === 0) {
      // Unknown id, someone else's key, and already-revoked all answer the same way:
      // distinguishing them would let a caller probe for key ids on other accounts.
      return NextResponse.json({ error: 'No such key' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
