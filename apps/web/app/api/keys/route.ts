import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

import { hashApiKey, requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string
    email?: string
    wallet_address?: string
    agent_client?: string
  } | null
  const name = body?.name?.trim() || null
  const email = body?.email?.trim() || null
  const walletAddress = body?.wallet_address?.trim() || null
  const agentClient = body?.agent_client?.trim() || null
  const id = nanoid(12)
  const key = `hs_sk_${nanoid(32)}`
  const keyHash = hashApiKey(key)

  try {
    const rows = (await sql`
      INSERT INTO api_keys (id, key_hash, name, email, wallet_address, agent_client)
      VALUES (${id}, ${keyHash}, ${name}, ${email}, ${walletAddress}, ${agentClient})
      RETURNING id, name, email, wallet_address, created_at
    `) as Array<{
      id: string
      name: string | null
      email: string | null
      wallet_address: string | null
      created_at: string
    }>

    const created = rows[0]

    return NextResponse.json(
      {
        id: created.id,
        key,
        name: created.name,
        email: created.email,
        wallet_address: created.wallet_address,
        created_at: created.created_at,
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  try {
    const rows = (await sql`
      SELECT id, name, created_at, last_used_at
      FROM api_keys
      WHERE id = ${auth.keyId}
      ORDER BY created_at DESC
    `) as Array<{
      id: string
      name: string | null
      created_at: string
      last_used_at: string | null
    }>

    return NextResponse.json(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
