import { NextResponse } from 'next/server'

import { remapErrorResponse, revokeRemap } from '@/lib/attribution/remap'
import { requireAuth } from '@/lib/auth'

/**
 * Revoke a mapping. Soft, always (§7).
 *
 * DELETE is the verb because that is what an agent reaches for, but nothing is deleted:
 * `revoked_at` is stamped and the row stays. The row is the record that a number was once
 * reported differently — remove it and two rollups of the same window disagree with no
 * explanation available to anyone, which is exactly the condition that makes an
 * attribution number unbelievable.
 *
 * Idempotent: revoking an already-revoked mapping is a 200 with `revoked: false` and the
 * original timestamp, not a 409. A retry that errors is a worse contract for an agent, and
 * moving `revoked_at` forward would rewrite when the mapping stopped applying.
 *
 * The response reports `resolved_responses`: how many completed responses this revocation
 * just returned to the unresolved list, in past windows as well as future ones, since the
 * rollup joins live remaps at read time.
 *
 * Ownership is enforced inside lib/attribution/remap.ts, and the UPDATE is scoped by
 * form_id as well — a remap id on its own is never enough to revoke someone else's
 * mapping. 404 covers "no such form", "not your form" and "no such remap" alike.
 */

type RouteContext = {
  params: Promise<{ id: string; remapId: string }>
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id, remapId } = await context.params

  try {
    return NextResponse.json(await revokeRemap(auth.accountId, id, remapId))
  } catch (error) {
    const response = remapErrorResponse(error)

    if (response) {
      return response
    }

    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
