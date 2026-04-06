import { NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id } = await context.params

  if (id !== auth.keyId) {
    return NextResponse.json(
      { error: 'You can only revoke the current API key' },
      { status: 403 },
    )
  }

  try {
    await sql`
      DELETE FROM api_keys
      WHERE id = ${auth.keyId}
    `

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
