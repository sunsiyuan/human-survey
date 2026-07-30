import { NextResponse } from 'next/server'

import { createRemap, listRemaps, remapErrorResponse } from '@/lib/attribution/remap'
import { requireAuth } from '@/lib/auth'

/**
 * Mappings from free text to a candidate: list them, create one. §7, and `remap` in
 * §10.4's tool table.
 *
 * A create is not an edit of anything. The rollup joins this table at read time, so one
 * row here moves every completed response carrying that text in every window that
 * contains it — past rollups included — with no backfill. That is the property the whole
 * feature exists for, and it is why the response reports `resolved_responses`: the number
 * of rows the caller just moved, so that "I mapped it and nothing changed" is visible
 * immediately rather than discovered in next month's numbers.
 *
 * A duplicate live mapping is a 409 naming the one already in place, not a 500: the
 * partial unique index exists because two live remaps of one string double-count in the
 * read-time join, so the refusal is meaningful and the caller needs to know what to
 * revoke.
 *
 * Ownership is enforced inside lib/attribution/remap.ts, which answers 404 for "no such
 * form" and "not your form" alike.
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
    return NextResponse.json(
      await listRemaps(auth.accountId, id, new URL(request.url).searchParams),
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id } = await context.params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  try {
    const created = await createRemap(auth.accountId, id, body)

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

function errorResponse(error: unknown) {
  const response = remapErrorResponse(error)

  if (response) {
    return response
  }

  const message = error instanceof Error ? error.message : 'Database error'
  return NextResponse.json({ error: message }, { status: 500 })
}
