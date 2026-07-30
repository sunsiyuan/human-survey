import { createHash, randomBytes } from 'node:crypto'

import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

import { sql } from '@/lib/db'

/**
 * API key auth.
 *
 * The key no longer *is* the identity. It points at an account, and the account owns
 * the data (docs/design/attribution-pivot.md §10.1). That one indirection is what
 * makes key rotation free — previously, replacing a key orphaned everything it had
 * created — and gives a lost key a recovery path that does not exist when the
 * credential and the identity are the same object.
 */

export type AuthResult = {
  keyId: string
  accountId: string
}

export async function requireAuth(request: Request): Promise<AuthResult | Response> {
  const header = request.headers.get('Authorization')

  if (!header?.startsWith('Bearer hs_sk_')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 },
    )
  }

  try {
    const rows = (await sql`
      SELECT id, account_id
      FROM api_keys
      WHERE key_hash = ${hashSecret(header.slice(7))}
        AND revoked_at IS NULL
      LIMIT 1
    `) as Array<{ id: string; account_id: string }>

    const row = rows[0]

    if (!row) {
      // Covers unknown keys and revoked keys alike — a revoked key is invalid.
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    void sql`
      UPDATE api_keys
      SET last_used_at = now()
      WHERE id = ${row.id}
    `.catch(() => {})

    return { keyId: row.id, accountId: row.account_id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export type AccountAuth = {
  accountId: string
  /**
   * The key that authenticated the request, or null when a session cookie did.
   *
   * Null is not "unknown" — it means no key was involved, so anything derived from it
   * (the `current` flag on the key list) is genuinely inapplicable rather than missing.
   */
  keyId: string | null
}

/**
 * Auth for the two routes a browser has to reach: key list, key issue, key revoke.
 *
 * Everything else takes a bearer key only, because everything else is an agent surface.
 * These three are different: the human-facing job of this product is to move a key from
 * here to an MCP config, and /account cannot present a key list at all if the only
 * accepted credential is a key the visitor does not have yet. A session cookie is
 * acceptable specifically because it proves the same thing a key proves — control of the
 * account's email address, established by a verified six-digit code — and because these
 * routes read and write nothing but the account's own credentials.
 *
 * A bearer header is handled by requireAuth verbatim, so every 401 an API caller can see
 * is identical to before this function existed. Note the precedence: a present-but-bad
 * Authorization header returns 401 and does NOT fall through to the cookie. An agent
 * whose key was just revoked must be told so, not silently promoted to whatever browser
 * session happens to be riding along on the same request.
 */
export async function requireAccount(request: Request): Promise<AccountAuth | Response> {
  if (request.headers.get('Authorization')) {
    return requireAuth(request)
  }

  try {
    const accountId = await resolveSession(readSessionCookie(request))

    if (!accountId) {
      // Same status and body as the bearer path's missing-credential case, including an
      // expired session: a caller holding nothing usable learns nothing about which
      // credential types exist from the error it gets back.
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 },
      )
    }

    return { accountId, keyId: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Confirm that a form belongs to the caller's account.
 *
 * Every attribution route needs this, and every one of them would otherwise be a
 * lookup by id alone — which is an authorization bug that reads like normal code.
 * Returns null when the form does not exist OR belongs to someone else: telling those
 * two apart would let anyone enumerate which form ids are real.
 */
export async function requireOwnedForm(accountId: string, formId: string) {
  const rows = (await sql`
    SELECT id, name, status, current_version, allowed_origins, theme, per_response_webhook_url
    FROM attribution_forms
    WHERE id = ${formId} AND account_id = ${accountId}
    LIMIT 1
  `) as Array<{
    id: string
    name: string
    status: string
    current_version: number | null
    allowed_origins: string[]
    theme: Record<string, unknown>
    per_response_webhook_url: string | null
  }>

  return rows[0] ?? null
}

export const API_KEY_PREFIX = 'hs_sk_'

export function generateApiKey() {
  return `${API_KEY_PREFIX}${nanoid(32)}`
}

/**
 * Mint a key for an account. Callers must have proven ownership of the account's email
 * first — the only path to here is a verified login code.
 */
export async function createApiKey(accountId: string, name?: string, agentClient?: string) {
  const id = nanoid(12)
  const key = generateApiKey()

  await sql`
    INSERT INTO api_keys (id, account_id, key_hash, name, agent_client)
    VALUES (${id}, ${accountId}, ${hashSecret(key)}, ${name ?? null}, ${agentClient ?? null})
  `

  return { id, key }
}

// --- browser sessions -------------------------------------------------------

const SESSION_TTL_DAYS = 30

export const SESSION_COOKIE = 'hs_session'

export async function createSession(accountId: string) {
  // 32 random bytes, stored hashed. A session token is a bearer credential exactly
  // like an API key and gets the same treatment: the database never holds a value
  // that could be replayed if it leaked.
  const token = randomBytes(32).toString('base64url')

  await sql`
    INSERT INTO sessions (token_hash, account_id, expires_at)
    VALUES (${hashSecret(token)}, ${accountId}, now() + ${`${SESSION_TTL_DAYS} days`}::interval)
  `

  return { token, maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 }
}

export async function resolveSession(token: string | undefined) {
  if (!token) {
    return null
  }

  const rows = (await sql`
    SELECT account_id
    FROM sessions
    WHERE token_hash = ${hashSecret(token)}
      AND expires_at > now()
    LIMIT 1
  `) as Array<{ account_id: string }>

  return rows[0]?.account_id ?? null
}

/**
 * Read the session token off a raw Cookie header.
 *
 * Hand-parsed rather than reached for through NextRequest.cookies or next/headers so
 * this module keeps taking a plain `Request` like every other function in it. cookies()
 * additionally only works inside a request scope, which a route handler has and a unit
 * test does not, and the alternative of typing every caller as NextRequest would spread
 * a framework type through the attribution routes that have no use for it.
 */
export function readSessionCookie(request: Request) {
  const header = request.headers.get('cookie')

  if (!header) {
    return undefined
  }

  for (const part of header.split(';')) {
    const eq = part.indexOf('=')

    if (eq === -1) {
      continue
    }

    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }

  return undefined
}

export async function destroySession(token: string | undefined) {
  if (!token) {
    return
  }

  await sql`DELETE FROM sessions WHERE token_hash = ${hashSecret(token)}`
}

/**
 * SHA-256 with no salt, used for API keys and session tokens alike.
 *
 * Correct here and NOT correct for the six-digit login codes, which are HMAC'd instead
 * (lib/auth/otp.ts). The difference is entropy: these are 32 random bytes, so a
 * precomputation attack has nothing to precompute, while six digits is a space small
 * enough to enumerate.
 */
export function hashSecret(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

/** @deprecated use {@link hashSecret} — kept as a name-compatible alias for now. */
export const hashApiKey = hashSecret
