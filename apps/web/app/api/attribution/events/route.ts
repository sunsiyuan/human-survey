import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'

/**
 * POST /api/attribution/events — conversion events, pushed by the host.
 *
 * Design contract: docs/design/attribution-pivot.md §9. This is the inbound half of the
 * `external_id` join: the host pushes what happened to a person, we already know which
 * channel that person named, and aggregate attribution becomes channel × revenue instead
 * of channel × heads. §9 documented the endpoint and nothing implemented it, which meant
 * the rollup's entire revenue half was unpopulatable by any customer — `revenue_cents` was
 * a column that could only ever be zero.
 *
 * Caller-pushed on purpose (§9, §12): a direct Stripe/AppsFlyer integration is what makes
 * a tool hard to remove, and also an unbounded maintenance surface. The schema is shaped
 * the way such an integration would want it, so adding one later is additive.
 *
 * Six decisions in here are load-bearing:
 *
 * 1. A BATCH IS THE PRIMARY SHAPE, a single event is the degenerate case. A customer
 *    backfilling a month of Stripe payments one HTTP request at a time is the shape that
 *    makes people give up before the first number exists — and a customer who gives up
 *    during backfill has a rollup whose revenue half is silently partial rather than
 *    empty, which is worse.
 * 2. ONE BAD ROW DOES NOT FAIL THE BATCH. Every element is validated independently and
 *    reported at its own index. A backfill of 400 payments that dies on row 217 leaves the
 *    caller to work out what landed; per-element results mean they can fix and resend
 *    exactly the rejects.
 * 3. THE SCHEMA'S CONSTRAINTS ARE HONOURED HERE, NOT DUPLICATED THERE.
 *    attribution_events_value_check (value_cents requires a currency) and the partial
 *    unique index on (form_id, idempotency_key) are both enforced in the database; the job
 *    of this file is to make each one arrive as a named field error or a clean duplicate
 *    report rather than as a 500 carrying a constraint name.
 * 4. A REPLAY IS A SUCCESS THAT SAYS SO. An idempotency key that already exists comes back
 *    as `status: 'duplicate'` naming the stored event, and — this is the part that matters
 *    — with a warning when the replayed payload DISAGREES with what is stored. A caller
 *    reusing one key for two different amounts otherwise believes the second amount landed,
 *    and every revenue number downstream is quietly the first one.
 * 5. RESPONDENT-INPUT RULES APPLY TO `external_id`. It arrives out of a caller's own
 *    database and will eventually contain something Postgres refuses at bind time. Same
 *    two classes lib/attribution/responses.ts rejects, for the same reasons, and the SAME
 *    trimming — the join key has to be byte-identical to the one the write path stored, or
 *    the event lands and joins to nobody.
 * 6. AN EVENT THAT JOINS TO NO RESPONSE IS REPORTED, NOT REJECTED. Events legitimately
 *    arrive for people who never answered the form, and usually arrive before they do — so
 *    this cannot be an error. But "we pushed a month of Stripe data and revenue is still
 *    zero" is almost always an id-format mismatch, and it is invisible until someone reads
 *    the rollup. `join_check` is the number that makes it visible at push time.
 *
 * Status codes, stated because a partially-accepted batch has to be distinguishable from a
 * batch that did nothing:
 *
 *   201  at least one event was created (some elements may still be rejected — read results)
 *   200  nothing new, but at least one element was a clean replay of a stored event
 *   400  nothing was written: a malformed envelope, or every element rejected
 *   404  nothing was written and every rejected element named a form this key cannot see —
 *        the same conflation of "no such form" and "not your form" every other route makes
 *
 * Everything lives in this file rather than in lib/attribution/: the ingest has no second
 * caller yet. When the MCP server grows a `push_events` tool, the parsing and the two
 * writes move to lib/attribution/events.ts unchanged, and this becomes an HTTP boundary
 * like the other routes.
 */

// A month of daily Stripe payouts, or a mid-sized backfill chunk. The cap exists because
// every element is bound as an array member in one statement: an unbounded batch is an
// unbounded query, and the failure mode is a timeout that leaves the caller unsure what
// landed — the exact uncertainty per-element results exist to remove.
const MAX_BATCH = 500

const MAX_ID = 128

// Matches MAX_EXTERNAL_ID in lib/attribution/responses.ts. The write path caps what can be
// stored, so a longer value here could never join to a response.
const MAX_EXTERNAL_ID = 256

const MAX_IDEMPOTENCY_KEY = 200

// ISO 4217 is three letters, but token symbols ("USDC") are longer and rejecting a
// caller's real currency loses the event permanently, while accepting an odd code only
// makes the rollup's multi-currency warning read strangely. Length-capped and
// alphabetic-only so it cannot smuggle anything into that warning's message.
const MAX_CURRENCY = 12
const CURRENCY = /^[A-Za-z]{2,12}$/

const EVENTS = new Set(['signup', 'activated', 'paid', 'churned'])

// How many unmatched ids to name in join_check. Enough to see the shape of the mismatch
// ("cus_…" against "usr_…"), not enough to echo a customer's whole user table back.
const MAX_JOIN_EXAMPLES = 5

// C0 and DEL, as code points rather than a character class — see hasControlCharacter at the
// foot of the file for why the class is not written out.
const CONTROL_LIMIT = 0x20
const DEL = 0x7f

type EventInput = {
  index: number
  id: string
  formId: string
  externalId: string
  event: string
  valueCents: number | null
  currency: string | null
  occurredAt: string
  idempotencyKey: string | null
}

/** An event already stored under this (form_id, idempotency_key). */
type StoredEvent = {
  id: string
  form_id: string
  external_id: string
  event: string
  value_cents: number | null
  currency: string | null
  occurred_at: string
  idempotency_key: string | null
  created_at: string
}

type EventResult =
  | {
      index: number
      status: 'created'
      id: string
      form_id: string
      external_id: string
      event: string
      idempotency_key: string | null
    }
  | {
      index: number
      status: 'duplicate'
      /** The id of the event that is stored — never the one this element would have minted. */
      id: string | null
      form_id: string
      external_id: string
      event: string
      idempotency_key: string
      existing: StoredEvent | null
      /** Non-empty when this replay disagrees with what is stored under the same key. */
      warnings: string[]
      /** Set when the key was already used by an earlier element of THIS request. */
      duplicate_of_index?: number
    }
  | { index: number; status: 'rejected'; errors: string[] }

type Ingest = {
  accepted: number
  duplicates: number
  rejected: number
  results: EventResult[]
  join_check: {
    checked: number
    matched: number
    unmatched: number
    /** Up to {@link MAX_JOIN_EXAMPLES} external_ids that no response of that form carries. */
    examples: string[]
  }
  notes: string[]
}

/** Carries the status, so every failure has one definition rather than a message match. */
class IngestError extends Error {
  status: number
  errors?: string[]

  constructor(status: number, message: string, errors?: string[]) {
    super(message)
    this.name = 'IngestError'
    this.status = status
    this.errors = errors
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request)

  if (auth instanceof Response) {
    return auth
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  try {
    return await ingest(auth.accountId, body)
  } catch (error) {
    if (error instanceof IngestError) {
      return NextResponse.json(
        error.errors && error.errors.length > 0
          ? { error: error.message, errors: error.errors }
          : { error: error.message },
        { status: error.status },
      )
    }

    // The caller holds a key for this account, so a driver message is theirs to see and is
    // the fastest route to a fix — same reasoning as the authenticated reads.
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function ingest(accountId: string, body: unknown): Promise<Response> {
  const elements = readElements(body)
  const results: EventResult[] = []
  const parsed: EventInput[] = []
  // Which rejections were ONLY about form ownership. A request that named nothing but
  // forms the caller cannot see answers 404 like every other attribution route, rather
  // than a 400 that would tell a key holder "that form exists, it just is not yours".
  let formRejections = 0

  elements.forEach((element, index) => {
    const errors: string[] = []
    const event = readEvent(element, index, errors)

    if (!event) {
      results.push({ index, status: 'rejected', errors })
      return
    }

    parsed.push(event)
  })

  const owned = await ownedForms(
    accountId,
    parsed.map((event) => event.formId),
  )

  const pending: EventInput[] = []

  for (const event of parsed) {
    if (!owned.has(event.formId)) {
      // Conflated exactly as requireOwnedForm conflates it: "no such form" and "not your
      // form" are one answer, or a key holder can walk the id space one event at a time.
      results.push({ index: event.index, status: 'rejected', errors: ['Form not found'] })
      formRejections += 1
      continue
    }

    pending.push(event)
  }

  // In-request deduplication, BEFORE the insert. ON CONFLICT DO NOTHING would also absorb
  // two elements sharing one key, but then the second element's report would have to be
  // reverse-engineered from which ids came back. Resolving it here means the second
  // occurrence can name the element it duplicates, which is the actionable fact: a
  // backfill script that reuses one key across a whole page of payments has a bug, and
  // "duplicate of index 0" says so where "duplicate" alone does not.
  const firstUse = new Map<string, EventInput>()
  const inBatchDuplicates: Array<{ event: EventInput; first: EventInput }> = []
  const insertable: EventInput[] = []

  for (const event of pending) {
    if (event.idempotencyKey === null) {
      insertable.push(event)
      continue
    }

    const key = pairKey(event.formId, event.idempotencyKey)
    const first = firstUse.get(key)

    if (first) {
      inBatchDuplicates.push({ event, first })
      continue
    }

    firstUse.set(key, event)
    insertable.push(event)
  }

  const created = await insertEvents(insertable)
  const skipped = insertable.filter((event) => !created.has(event.id))
  const existing = await existingEvents(skipped)

  for (const event of insertable) {
    if (created.has(event.id)) {
      results.push({
        index: event.index,
        status: 'created',
        id: event.id,
        form_id: event.formId,
        external_id: event.externalId,
        event: event.event,
        idempotency_key: event.idempotencyKey,
      })
      continue
    }

    results.push(duplicateResult(event, existing, null))
  }

  for (const { event, first } of inBatchDuplicates) {
    results.push({
      ...duplicateResult(event, existing, first),
      duplicate_of_index: first.index,
    })
  }

  results.sort((a, b) => a.index - b.index)

  const accepted = results.filter((result) => result.status === 'created').length
  const duplicates = results.filter((result) => result.status === 'duplicate').length
  const rejected = results.length - accepted - duplicates

  if (accepted === 0 && duplicates === 0) {
    if (rejected > 0 && rejected === formRejections) {
      throw new IngestError(404, 'Form not found')
    }

    // Nothing was written, so this is a failed request and must not answer 200 — a caller
    // whose whole batch was malformed would otherwise read a success and move on. The
    // per-element results ride along, because they are what says which field to fix.
    return NextResponse.json(
      {
        error: 'No event was accepted',
        ...(await payload(accepted, duplicates, rejected, results, [])),
      },
      { status: 400 },
    )
  }

  const stored = [...insertable, ...inBatchDuplicates.map(({ event }) => event)]

  return NextResponse.json(await payload(accepted, duplicates, rejected, results, stored), {
    status: accepted > 0 ? 201 : 200,
  })
}

async function payload(
  accepted: number,
  duplicates: number,
  rejected: number,
  results: EventResult[],
  stored: EventInput[],
): Promise<Ingest> {
  const join = await checkJoins(stored)

  const notes = [
    'value_cents is summed as revenue ONLY for event=\'paid\'. A value on signup, activated or churned is stored and never counted, so a refund has to be pushed as a negative-value paid event if it is to move the total.',
    'value_cents requires currency (attribution_events_value_check). The rollup sums cents across whatever currencies it finds and warns when there is more than one; it does not convert.',
    'An event with no idempotency_key cannot be deduplicated — (form_id, idempotency_key) is the only unique key on this table and it is partial — so a retried request stores the event twice and doubles that person\'s revenue.',
    'occurred_at is stored as sent and is NOT what the rollup windows on. The rollup windows on the response\'s completed_at and then sums ALL paid events for the responses in it, whatever their date: a payment in March belongs to the channel recorded in January.',
    'Events join to responses on external_id alone (§9), with no foreign key: an event for someone who never answered the form is stored and joins to nothing. That is legitimate and expected — the event usually arrives before the answer — which is why join_check is a count and not a rejection.',
    'Revenue is booked against the FIRST response per (form_id, external_id) (§9). A retake counts as a response and books no revenue, so pushing events for a person who answered twice moves exactly one row.',
  ]

  if (join.unmatched > 0) {
    notes.push(
      `${join.unmatched} of ${join.checked} external_ids match no response of the named form. If that is not what you expect, the ids on this side and the ids the embed sends are in different formats, and every one of these events will book revenue to nothing — examples: ${join.examples.join(', ')}.`,
    )
  }

  return { accepted, duplicates, rejected, results, join_check: join, notes }
}

/**
 * A duplicate report: the stored event, and every way this replay disagrees with it.
 *
 * The disagreement check is the point. An idempotency key is a promise that the same key
 * means the same event, and a caller who reuses one for a different amount gets no error
 * from the database — the row is simply not written. Without this they read `duplicate`,
 * conclude the event was already there, and never learn that the amount they believe is
 * stored is not.
 */
function duplicateResult(
  event: EventInput,
  existing: Map<string, StoredEvent>,
  first: EventInput | null,
): Extract<EventResult, { status: 'duplicate' }> {
  // Only reachable for a keyed event: an element with no idempotency_key cannot conflict
  // with anything (the unique index is partial), so it is never skipped and never an
  // in-batch duplicate.
  const key = event.idempotencyKey as string
  const stored = existing.get(pairKey(event.formId, key)) ?? null
  const warnings: string[] = []
  // An in-batch duplicate whose first occurrence was itself created has no stored row to
  // compare against yet, so the first element's own values are the comparison.
  const against = stored ?? (first ? storedFrom(first) : null)

  if (!against) {
    warnings.push(
      'the event stored under this idempotency_key could not be read back; it may have been deleted between the insert and this read',
    )
  } else {
    for (const [field, replayed, kept] of [
      ['external_id', event.externalId, against.external_id],
      ['event', event.event, against.event],
      ['value_cents', event.valueCents, against.value_cents],
      ['currency', event.currency, against.currency],
      ['occurred_at', event.occurredAt, against.occurred_at],
    ] as const) {
      if (replayed !== kept) {
        warnings.push(
          `${field} in this request is ${describe(replayed)} but the stored event under this idempotency_key has ${describe(kept)}; the stored value is unchanged`,
        )
      }
    }
  }

  return {
    index: event.index,
    status: 'duplicate',
    id: against?.id ?? null,
    form_id: event.formId,
    external_id: event.externalId,
    event: event.event,
    idempotency_key: key,
    existing: stored,
    warnings,
  }
}

function describe(value: string | number | null): string {
  return value === null ? 'null' : JSON.stringify(value)
}

/**
 * The row an element of THIS request just wrote, as the comparison target for a later
 * element sharing its key.
 *
 * `created_at` is synthesized, which is why this value is used for the comparison and for
 * the id only and never shipped as `existing`: a fabricated timestamp in a field a reader
 * takes as read from the database is exactly the kind of number this codebase refuses to
 * emit.
 */
function storedFrom(event: EventInput): StoredEvent {
  return {
    id: event.id,
    form_id: event.formId,
    external_id: event.externalId,
    event: event.event,
    value_cents: event.valueCents,
    currency: event.currency,
    occurred_at: event.occurredAt,
    idempotency_key: event.idempotencyKey,
    created_at: new Date().toISOString(),
  }
}

/** JSON rather than a delimiter: form ids and idempotency keys are both caller-defined. */
function pairKey(formId: string, key: string): string {
  return JSON.stringify([formId, key])
}

// --- writes -----------------------------------------------------------------

/**
 * One multi-row INSERT, returning the ids that landed.
 *
 * ON CONFLICT DO NOTHING against the partial unique index makes a replay the 200 it should
 * be. The alternative — SELECT first, then insert what is missing — is a separate round
 * trip outside any transaction, so a concurrent identical push still slips past it and dies
 * on the index: a 500 for what is a duplicate. Same shape, same reason, as createRemap.
 *
 * The ids are minted here rather than read back by ordinal, because RETURNING gives no way
 * to tell WHICH input rows were skipped: a set difference against ids we chose does.
 */
async function insertEvents(events: EventInput[]): Promise<Set<string>> {
  if (events.length === 0) {
    return new Set()
  }

  const rows = (await sql`
    INSERT INTO attribution_events (
      id, form_id, external_id, event, value_cents, currency, occurred_at, idempotency_key
    )
    SELECT * FROM unnest(
      ${events.map((event) => event.id)}::text[],
      ${events.map((event) => event.formId)}::text[],
      ${events.map((event) => event.externalId)}::text[],
      ${events.map((event) => event.event)}::text[],
      ${events.map((event) => event.valueCents)}::bigint[],
      ${events.map((event) => event.currency)}::text[],
      ${events.map((event) => event.occurredAt)}::timestamptz[],
      ${events.map((event) => event.idempotencyKey)}::text[]
    )
    ON CONFLICT (form_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>

  return new Set(rows.map((row) => row.id))
}

// --- reads ------------------------------------------------------------------

/**
 * requireOwnedForm's rule, applied to a set.
 *
 * One statement rather than one probe per element: a backfill names the same form five
 * hundred times, and five hundred round trips to answer one question is the difference
 * between a batch that completes and a batch that times out. Absence from the result is the
 * same conflation requireOwnedForm makes — unknown form and someone else's form are one
 * answer.
 */
async function ownedForms(accountId: string, formIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(formIds)]

  if (ids.length === 0) {
    return new Set()
  }

  const rows = (await sql`
    SELECT id
    FROM attribution_forms
    WHERE account_id = ${accountId}
      AND id = ANY(${ids}::text[])
  `) as Array<{ id: string }>

  return new Set(rows.map((row) => row.id))
}

/** The stored events behind the rows the insert skipped, keyed by (form_id, key). */
async function existingEvents(skipped: EventInput[]): Promise<Map<string, StoredEvent>> {
  const keyed = skipped.filter((event) => event.idempotencyKey !== null)

  if (keyed.length === 0) {
    return new Map()
  }

  const rows = (await sql`
    SELECT id, form_id, external_id, event, value_cents::text AS value_cents, currency,
           occurred_at, idempotency_key, created_at
    FROM attribution_events
    WHERE (form_id, idempotency_key) IN (
      SELECT * FROM unnest(
        ${keyed.map((event) => event.formId)}::text[],
        ${keyed.map((event) => event.idempotencyKey as string)}::text[]
      )
    )
  `) as Array<{
    id: string
    form_id: string
    external_id: string
    event: string
    value_cents: string | null
    currency: string | null
    occurred_at: string | Date
    idempotency_key: string
    created_at: string | Date
  }>

  return new Map(
    rows.map((row) => [
      pairKey(row.form_id, row.idempotency_key),
      {
        id: row.id,
        form_id: row.form_id,
        external_id: row.external_id,
        event: row.event,
        // int8 arrives from the driver as a string. Every value this endpoint stores is
        // inside the JS safe-integer range (see readCents), so Number() is exact for
        // anything written through here, and the comparison in duplicateResult is against
        // a number.
        value_cents: row.value_cents === null ? null : Number(row.value_cents),
        currency: row.currency,
        // The driver hands back a Date for timestamptz. Normalized to the same ISO spelling
        // the request was normalized to, so the duplicate comparison is not a Date against
        // a string — which is never equal, and would warn on every honest replay.
        occurred_at: instant(row.occurred_at),
        idempotency_key: row.idempotency_key,
        created_at: instant(row.created_at),
      },
    ]),
  )
}

/**
 * How many of the pushed ids can ever join to an answer.
 *
 * Deliberately not filtered on `completed_seq IS NOT NULL`, unlike the rollup: an in-flight
 * response will complete, and reporting its identity as unmatched would make this number
 * fire on the very case the endpoint is designed around — the event arriving first.
 */
async function checkJoins(events: EventInput[]): Promise<Ingest['join_check']> {
  const pairs = new Map(
    events.map((event) => [pairKey(event.formId, event.externalId), event]),
  )

  if (pairs.size === 0) {
    return { checked: 0, matched: 0, unmatched: 0, examples: [] }
  }

  const distinct = [...pairs.values()]

  const rows = (await sql`
    SELECT DISTINCT form_id, external_id
    FROM attribution_responses
    WHERE (form_id, external_id) IN (
      SELECT * FROM unnest(
        ${distinct.map((event) => event.formId)}::text[],
        ${distinct.map((event) => event.externalId)}::text[]
      )
    )
  `) as Array<{ form_id: string; external_id: string }>

  const matched = new Set(rows.map((row) => pairKey(row.form_id, row.external_id)))
  const unmatched = distinct.filter(
    (event) => !matched.has(pairKey(event.formId, event.externalId)),
  )

  return {
    checked: distinct.length,
    matched: distinct.length - unmatched.length,
    unmatched: unmatched.length,
    examples: unmatched.slice(0, MAX_JOIN_EXAMPLES).map((event) => event.externalId),
  }
}

// --- payload ----------------------------------------------------------------

/**
 * The elements of this request, whichever of the three shapes it arrived in:
 *
 *   { form_id, external_id, event, occurred_at, … }   one event — §9's documented shape
 *   { form_id?, events: [ … ] }                       a batch, form_id inheritable
 *   [ … ]                                             a bare array of events
 *
 * The inheritable top-level `form_id` is not sugar. Without it a backfill repeats the same
 * form id five hundred times, and a caller who gets one of those five hundred wrong has a
 * batch that is 499/500 correct and one event booked against a form that is not the one
 * they meant — which no error can catch, because it is a valid request.
 */
function readElements(body: unknown): unknown[] {
  if (!Array.isArray(body) && !isRecord(body)) {
    throwIngest('Request body must be an event object, an array of events, or { events: [ … ] }')
  }

  const elements = Array.isArray(body) ? body : readEnvelope(body)

  if (elements.length === 0) {
    throwIngest('events must contain at least one event')
  }

  if (elements.length > MAX_BATCH) {
    throwIngest(
      `events must contain at most ${MAX_BATCH} events; split the backfill into pages of that size`,
    )
  }

  return elements
}

function readEnvelope(body: Record<string, unknown>): unknown[] {
  if (body.events === undefined || body.events === null) {
    return [body]
  }

  if (!Array.isArray(body.events)) {
    throwIngest('events must be an array of event objects')
  }

  // The envelope's own form_id is pushed onto each element that omits one, so the rest of
  // the pipeline sees one shape and there is no second place where "which form is this"
  // gets decided.
  return body.events.map((element) =>
    isRecord(element) && element.form_id === undefined && body.form_id !== undefined
      ? { ...element, form_id: body.form_id }
      : element,
  )
}

function readEvent(value: unknown, index: number, errors: string[]): EventInput | null {
  if (!isRecord(value)) {
    errors.push('event must be an object')
    return null
  }

  const formId = readString(value.form_id, 'form_id', { required: true, max: MAX_ID }, errors)
  const externalId = readString(
    value.external_id,
    'external_id',
    { required: true, max: MAX_EXTERNAL_ID },
    errors,
  )
  const event = readEventName(value.event, errors)
  const valueCents = readCents(value.value_cents, errors)
  const currency = readCurrency(value.currency, errors)
  const occurredAt = readInstant(value.occurred_at, errors)
  const idempotencyKey = readString(
    value.idempotency_key,
    'idempotency_key',
    { max: MAX_IDEMPOTENCY_KEY },
    errors,
  )

  // attribution_events_value_check, named as the field pair it is. Reaching the database
  // with this would be a 500 quoting a constraint name at a caller who cannot see the
  // schema — and on a batch, one bad row would take the whole backfill with it.
  //
  // Only when `currency` was absent. A currency that was sent and rejected already has its
  // own error, and two messages about one field read as two problems to fix.
  if (valueCents !== null && (value.currency === undefined || value.currency === null)) {
    errors.push(
      'value_cents requires currency: money with no unit cannot be summed, and the schema refuses it',
    )
  }

  if (errors.length > 0 || formId === null || externalId === null || !event || !occurredAt) {
    return null
  }

  return {
    index,
    id: nanoid(12),
    formId,
    externalId,
    event,
    valueCents,
    currency,
    occurredAt,
    idempotencyKey,
  }
}

function readEventName(value: unknown, errors: string[]): string | null {
  if (typeof value !== 'string' || !EVENTS.has(value)) {
    errors.push(`event must be one of ${[...EVENTS].join(', ')}`)
    return null
  }

  return value
}

/**
 * `value_cents`, bounded by what a JS number can hold exactly rather than by int8.
 *
 * The column is a BIGINT, but JSON numbers arrive as doubles: 2^53 + 1 parses to 2^53, and
 * accepting it would store an amount the caller never sent, silently, in the one field the
 * whole revenue half of the rollup is made of. A refusal is recoverable; a rounded amount
 * is not, because nothing downstream can tell it was rounded.
 *
 * Negatives are allowed on purpose: a refund is a negative paid event, and that is the only
 * way to move a total back down (there is no event kind for it).
 */
function readCents(value: unknown, errors: string[]): number | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    errors.push(
      'value_cents must be an integer number of minor units within ±(2^53 - 1); send larger amounts in a currency with fewer decimals rather than as a rounded number',
    )
    return null
  }

  return value
}

function readCurrency(value: unknown, errors: string[]): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string') {
    errors.push('currency must be a string')
    return null
  }

  const text = value.trim()

  if (text.length === 0) {
    errors.push('currency must not be empty')
    return null
  }

  if (text.length > MAX_CURRENCY || !CURRENCY.test(text)) {
    errors.push(
      `currency must be ${MAX_CURRENCY} letters or fewer, e.g. "USD" — the rollup groups on it and does not convert between currencies`,
    )
    return null
  }

  // Upper-cased so one customer's "usd" and "USD" cannot read as two currencies in a
  // rollup's multi-currency warning. The rollup lowercases for its own grouping, so this
  // only has to be consistent, not any particular case.
  return text.toUpperCase()
}

/**
 * `occurred_at`, parsed here and re-emitted as an ISO instant.
 *
 * Parsed in JavaScript rather than handed to Postgres so the interpretation is not split
 * between two engines: a bare date means UTC midnight here, while Postgres would read it in
 * the server's timezone and quietly shift the event hours from where the caller meant it.
 * Same rule as the remap window parameters.
 */
const MIN_INSTANT_MS = Date.parse('1970-01-01T00:00:00Z')
const MAX_INSTANT_MS = Date.parse('2100-01-01T00:00:00Z')

function readInstant(value: unknown, errors: string[]): string | null {
  if (value === undefined || value === null) {
    errors.push(
      'occurred_at is required: an event with no time cannot be ordered against the response it joins to',
    )
    return null
  }

  if (typeof value !== 'string') {
    errors.push('occurred_at must be an ISO 8601 timestamp string')
    return null
  }

  const parsed = Date.parse(value.trim())

  if (Number.isNaN(parsed)) {
    errors.push('occurred_at must be an ISO 8601 timestamp, e.g. "2026-07-30T11:02:00Z"')
    return null
  }

  // Date.parse accepts times Postgres refuses, and a timestamptz bind failure is a 500
  // that takes the WHOLE batch with it — which is the outcome per-element validation
  // exists to prevent. Year 0 is the one that actually shows up: a null date rendered by a
  // templating layer arrives as "0000-01-01T00:00:00Z", parses fine, and the driver throws.
  // The upper bound catches a millisecond value pasted where a string belongs.
  if (parsed < MIN_INSTANT_MS || parsed > MAX_INSTANT_MS) {
    errors.push(
      'occurred_at must fall between 1970-01-01 and 2100-01-01 — a value outside that range is a formatting bug, not a real event time',
    )
    return null
  }

  return new Date(parsed).toISOString()
}

/** A driver timestamp — Date for timestamptz — in one spelling. */
function instant(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

/**
 * Trimmed exactly as lib/attribution/responses.ts trims the same fields.
 *
 * That is not tidiness: `external_id` is a join key, and if one side trims while the other
 * does not, the event is stored, joins to no response, and produces a rollup where revenue
 * is zero with every individual row looking correct.
 */
function readString(
  value: unknown,
  where: string,
  options: { required?: boolean; max: number },
  errors: string[],
): string | null {
  if (value === undefined || value === null) {
    if (options.required) {
      errors.push(`${where} is required`)
    }

    return null
  }

  if (typeof value !== 'string') {
    errors.push(`${where} must be a string`)
    return null
  }

  const text = value.trim()

  if (text.length === 0) {
    if (options.required) {
      errors.push(`${where} must not be empty`)
    }

    return null
  }

  if (text.length > options.max) {
    errors.push(`${where} must be at most ${options.max} characters`)
    return null
  }

  if (hasControlCharacter(text)) {
    errors.push(`${where} must not contain control characters`)
    return null
  }

  if (hasLoneSurrogate(text)) {
    errors.push(`${where} must not contain unpaired UTF-16 surrogates`)
    return null
  }

  return text
}

/**
 * C0 and DEL. Every string on this endpoint is an identifier, so — unlike free text on the
 * respondent path — tab, newline and carriage return are NOT exempt: an id copied out of a
 * spreadsheet cell with a trailing tab is a different id, and it would join to nothing.
 *
 * Postgres refuses a NUL inside a text bind parameter, so one arriving in `external_id`
 * becomes a 500 carrying a raw driver error rather than a named field error. The rest of the
 * range rides along because none of it belongs in an id and all of it survives a round trip
 * invisibly.
 *
 * Written as code-point arithmetic rather than a character class, for the reason
 * lib/attribution/remap.ts gives and this file then demonstrated: the class has to be
 * spelled with escapes, and the escapes did not survive being written to disk — the guard
 * silently became a regex matching the literal characters it existed to exclude, which is a
 * validator that accepts exactly what it was there to reject.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)

    if (code < CONTROL_LIMIT || code === DEL) {
      return true
    }
  }

  return false
}

/**
 * Either surrogate half without its partner.
 *
 * Reachable from any JSON body — "\ud800" is valid JSON — and text parameters do not error
 * on it: Node substitutes U+FFFD when encoding to UTF-8, which silently rewrites the join
 * key, so the event is stored against an id nobody has and nothing anywhere says why.
 */
function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    const high = code >= 0xd800 && code <= 0xdbff
    const low = code >= 0xdc00 && code <= 0xdfff

    if (low) {
      return true
    }

    if (high) {
      const next = value.charCodeAt(index + 1)

      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true
      }

      index += 1
    }
  }

  return false
}

function throwIngest(message: string): never {
  throw new IngestError(400, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
