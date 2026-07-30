import { NextResponse } from 'next/server'

import { listUnresolved, remapErrorResponse } from '@/lib/attribution/remap'
import { requireAuth } from '@/lib/auth'

/**
 * Free text awaiting a mapping — the read half of §7's remap loop, and `list_unresolved`
 * in §10.4's tool table.
 *
 * Grouped by (node_id, raw_normalized), ordered by occurrence count descending, because
 * an agent working this list should reach the twelve-occurrence entry before the
 * singleton. Entries a live remap already covers are excluded unless `include_mapped=1`.
 *
 * Query: node_id, from, to, include_mapped, limit, offset. The window filters on the
 * response's completed_at and `to` is exclusive, both matching the rollup, so a caller can
 * hand the same pair to either endpoint and get numbers that reconcile.
 *
 * Ownership is enforced inside lib/attribution/remap.ts, which answers 404 for "no such
 * form" and "not your form" alike — telling those apart would let anyone enumerate form
 * ids.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id } = await context.params

  try {
    const page = await listUnresolved(
      auth.accountId,
      id,
      new URL(request.url).searchParams,
    )

    return NextResponse.json(page)
  } catch (error) {
    const response = remapErrorResponse(error)

    if (response) {
      return response
    }

    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
