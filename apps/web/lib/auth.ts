import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { sql } from '@/lib/db'

export type AuthResult = {
  keyId: string
}

export async function requireAuth(request: Request): Promise<AuthResult | Response> {
  const header = request.headers.get('Authorization')

  if (!header?.startsWith('Bearer mts_sk_')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 },
    )
  }

  try {
    const rows = (await sql`
      SELECT id
      FROM api_keys
      WHERE key_hash = ${hashApiKey(header.slice(7))}
      LIMIT 1
    `) as Array<{ id: string }>

    const row = rows[0]

    if (!row) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    void sql`
      UPDATE api_keys
      SET last_used_at = now()
      WHERE id = ${row.id}
    `.catch(() => {})

    return { keyId: row.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export function hashApiKey(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
