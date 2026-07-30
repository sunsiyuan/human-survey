import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

import { nanoid } from 'nanoid'

import { sql, tx } from '@/lib/db'
import { sendLoginCode } from '@/lib/email'

/**
 * Six-digit email codes — the only sign-in mechanism.
 *
 * One flow serves both entry points (docs/design/attribution-pivot.md §10.2): the
 * browser exchanges a verified code for a session, and the MCP server exchanges one
 * for an API key that it writes straight to its own config file. The second is the
 * point of the design — it is what stops an API key from living in an agent
 * transcript, which is why keys were getting lost.
 *
 * Signing in and signing up are the same act. An unknown address that verifies a code
 * gets an account; there is no separate registration step to abandon halfway.
 *
 * Six digits is a 10^6 space, so the throttles below are not hardening — they are the
 * only thing making the mechanism sound at all. Unthrottled, a million guesses
 * finishes well inside any usable expiry window.
 */

const CODE_TTL_MINUTES = 10
const MAX_ATTEMPTS = 5
const MAX_CODES_PER_EMAIL_PER_HOUR = 5

// Higher than the per-email cap so a shared office NAT or a corporate proxy does not
// lock out a team, low enough that the endpoint cannot be used to mail a harvested
// list. The per-email cap is what protects an individual; this is what protects the
// sending domain.
const MAX_CODES_PER_IP_PER_HOUR = 20

export type VerifyFailure =
  | 'no_code'      // nothing outstanding for this address
  | 'expired'
  | 'too_many_attempts'
  | 'bad_code'

export class RateLimitedError extends Error {
  constructor() {
    super('Too many codes requested for this address; try again later')
    this.name = 'RateLimitedError'
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

/**
 * HMAC rather than a bare digest. A plain SHA-256 over six digits is a rainbow table
 * anyone can build in about a second, so a database leak would otherwise hand over
 * every code in flight. Binding the address into the input additionally means a hash
 * lifted from one row cannot be replayed against another.
 */
function hashCode(email: string, code: string) {
  const secret = process.env.LOGIN_CODE_SECRET

  if (!secret) {
    throw new Error('LOGIN_CODE_SECRET must be set')
  }

  return createHmac('sha256', secret).update(`${normalizeEmail(email)}:${code}`).digest('hex')
}

function equalHashes(a: string, b: string) {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')

  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * randomInt, not Math.random. The latter is a PRNG whose output is predictable from
 * previous draws — for a login code that is a full authentication bypass, not a
 * quality-of-randomness quibble.
 */
function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export async function issueLoginCode(email: string, ip: string | null): Promise<void> {
  const normalized = normalizeEmail(email)

  // Two counters, protecting two different things. The per-address one stops a single
  // person being mail-bombed; the per-IP one stops the endpoint being used as a relay
  // to mail a harvested list from our verified domain, which is the failure that costs
  // us deliverability for every legitimate code afterwards.
  const recent = (await sql`
    SELECT
      count(*) FILTER (WHERE lower(email) = ${normalized})::int AS by_email,
      count(*) FILTER (WHERE ip IS NOT NULL AND ip = ${ip})::int AS by_ip
    FROM login_codes
    WHERE created_at > now() - interval '1 hour'
  `) as Array<{ by_email: number; by_ip: number }>

  if (
    recent[0].by_email >= MAX_CODES_PER_EMAIL_PER_HOUR ||
    (ip !== null && recent[0].by_ip >= MAX_CODES_PER_IP_PER_HOUR)
  ) {
    throw new RateLimitedError()
  }

  const code = generateCode()

  await sql`
    INSERT INTO login_codes (id, email, code_hash, expires_at, ip)
    VALUES (
      ${nanoid(12)},
      ${normalized},
      ${hashCode(normalized, code)},
      now() + ${`${CODE_TTL_MINUTES} minutes`}::interval,
      ${ip}
    )
  `

  // Deliberately after the insert. A send that fails leaves an unused row that expires
  // harmlessly; an insert that fails after a successful send would leave the person
  // holding a code that can never work.
  await sendLoginCode(normalized, code)
}

/**
 * Verify a code and return the account it belongs to, creating one if this address has
 * never signed in before.
 *
 * Returns a discriminated result rather than throwing, because every failure here is
 * an expected outcome that the caller has to render differently.
 */
export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<{ ok: true; accountId: string } | { ok: false; reason: VerifyFailure }> {
  const normalized = normalizeEmail(email)

  // Claim an attempt and read the row in ONE statement.
  //
  // The obvious shape — SELECT attempts, compare against the ceiling, UPDATE on
  // failure — is three round trips with nothing serializing them, so N concurrent
  // requests all read the same attempts value, all pass the check, and all get a
  // guess. The ceiling then bounds sequential guessing only, and the six-digit space
  // falls to anyone willing to open five hundred sockets. `attempts < ceiling` inside
  // the UPDATE's own WHERE is what makes the counter a lock rather than a suggestion.
  const rows = (await sql`
    UPDATE login_codes
    SET attempts = attempts + 1
    WHERE id = (
      SELECT id
      FROM login_codes
      WHERE lower(email) = ${normalized}
        AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    )
      AND attempts < ${MAX_ATTEMPTS}
    RETURNING id, code_hash, expires_at
  `) as Array<{ id: string; code_hash: string; expires_at: string }>

  const row = rows[0]

  if (!row) {
    // Nothing was claimed: either there is no live code, or its attempts are spent.
    // This follow-up read only picks between two error messages — it cannot be raced
    // into an extra guess, because the guess was already refused above.
    const existing = (await sql`
      SELECT attempts
      FROM login_codes
      WHERE lower(email) = ${normalized}
        AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `) as Array<{ attempts: number }>

    return existing[0]
      ? { ok: false, reason: 'too_many_attempts' }
      : { ok: false, reason: 'no_code' }
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  if (!equalHashes(row.code_hash, hashCode(normalized, code))) {
    return { ok: false, reason: 'bad_code' }
  }

  const accountId = await consumeAndResolveAccount(row.id, normalized)

  return { ok: true, accountId }
}

/**
 * Burn the code and resolve the account in one transaction, so a crash between the two
 * cannot leave a code consumed with nobody signed in — the person would be stuck until
 * they requested another.
 *
 * The account insert is ON CONFLICT DO NOTHING against the case-insensitive unique
 * index, then read back: two tabs verifying two codes at once would otherwise race to
 * create the same account and one would fail.
 */
async function consumeAndResolveAccount(codeId: string, email: string) {
  const id = nanoid(12)

  await tx([
    sql`UPDATE login_codes SET consumed_at = now() WHERE id = ${codeId}`,
    sql`
      INSERT INTO accounts (id, email)
      VALUES (${id}, ${email})
      ON CONFLICT (lower(email)) DO NOTHING
    `,
  ])

  const rows = (await sql`
    SELECT id FROM accounts WHERE lower(email) = ${email} LIMIT 1
  `) as Array<{ id: string }>

  return rows[0].id
}
