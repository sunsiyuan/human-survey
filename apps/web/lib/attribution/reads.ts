import { requireOwnedForm } from '@/lib/auth'
import { parseJsonValue, sql } from '@/lib/db'

import { ensureSwept } from './sweep'

/**
 * Raw response reads: the agent's delta cursor, and the per-identity lookup.
 *
 * Design contract: docs/design/attribution-pivot.md §11.2 (cursor reads are the primary
 * read path) and §9 (`external_id` in the outbound direction — attribution as a property
 * of a user record rather than a monthly report).
 *
 * These are the two reads that hand back rows rather than aggregates, and five things in
 * here are load-bearing:
 *
 * 1. THE CURSOR IS `completed_seq`, NEVER `seq` OR `created_at`. `seq` is INSERT order on
 *    a table whose rows become complete later (§5.4's visibility gate), so a cursor over
 *    it would hand an agent the channel answer and never the creator answer — the half of
 *    the data this product exists to collect. `completed_seq` is stamped by
 *    stamp_response_completion() at the moment a response becomes final, under a form-row
 *    lock that forces commit order to match allocation order, so it is the only monotonic
 *    token that matches the order rows become readable in.
 * 2. ONLY COMPLETED RESPONSES ARE VISIBLE, on BOTH reads. `completed_seq IS NOT NULL` is
 *    the gate. An in-flight response is not data yet, so an identity lookup that returns
 *    nothing can mean "still answering", not "never answered" — which is why the same
 *    filter is applied to both rather than only to the one that needs it for ordering.
 * 3. FREE TEXT IS RESOLVED AGAINST THE LIVE REMAP TABLE AT READ TIME, exactly as the
 *    rollup does it (§7): `COALESCE(live_remap.candidate_id, answers.candidate_id)`,
 *    joined on `(form_id, node_id, raw_normalized) WHERE revoked_at IS NULL`. That is what
 *    makes one mapping fix two months of history, and it only works because nothing is
 *    ever pre-aggregated.
 * 4. THE VERBATIM `raw` AND THE UNRESOLVED `candidate_id` SHIP ALONGSIDE THE RESOLVED
 *    VALUE. A caller that only ever sees the resolved answer cannot audit a mapping it
 *    disagrees with, and the remap table is editable by whoever holds the key.
 * 5. `open_responses` IS DERIVED FROM THE PAGE'S OWN SNAPSHOT, never from a second read
 *    after it. It is the one field here an agent acts on by stopping, so a stale true is
 *    not a delay, it is a row that is never delivered to anybody. See readPage.
 */

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

// Matches MAX_EXTERNAL_ID in ./responses — the write path caps what can be stored, so a
// longer value here cannot match anything and is a client bug worth naming.
const MAX_EXTERNAL_ID = 256

// The form id arrives off the route path and every id in this file is bound as a text
// parameter.
const MAX_ID = 128

// bigint upper bound. A cursor past it reaches the driver and comes back as SQLSTATE
// 22003 "bigint out of range", i.e. a 500 for what is a malformed query parameter.
//
// BigInt('…') rather than a `…n` literal because tsconfig targets ES2017, where the
// literal syntax is a compile error while the constructor is fine.
const MAX_BIGINT = BigInt('9223372036854775807')

// Postgres refuses a NUL inside a text parameter at bind time, so one pasted into a query
// param — /forms/%00/responses decodes to exactly that — becomes a 500 carrying a raw
// driver error instead of a validation failure. The rest of the C0 set and DEL ride along:
// none of them belongs in an id. Lone surrogates are deliberately NOT rejected here,
// unlike on the write path (see ./responses): Node substitutes U+FFFD when encoding a text
// parameter, which on a read can only fail to match a row, and silently matching nothing
// is the correct answer for a value that was never storable in the first place.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

export type AnswerRead = {
  node_id: string
  kind: 'candidate' | 'raw' | 'dont_remember' | 'skipped'
  /** Verbatim, exactly as typed. Never normalized (§7). */
  raw: string | null
  /** The candidate the respondent picked, before any remap is applied. */
  candidate_id: string | null
  /** `COALESCE(live_remap.candidate_id, candidate_id)` — the current answer to "which candidate". */
  resolved_candidate_id: string | null
  /**
   * Where `resolved_candidate_id` came from. `remap` means the respondent typed free text
   * and a live remap row resolves it today; revoking that row changes this read.
   */
  resolved_via: 'answer' | 'remap' | null
  /**
   * Label from the most recent config version that contains `resolved_candidate_id` in
   * this node (§4, decision 8) — NOT from the live platform catalog, so a product-side
   * rename cannot rewrite what an old response says was shown.
   *
   * Null when no version ever contained the id, which is normal for a remap target: §7
   * deliberately makes it not a foreign key, because a candidate can be dropped from the
   * config while history still needs the mapping.
   */
  resolved_label: string | null
  /** Rendered index in the initial unfiltered list; null when no position exists (§5.3). */
  position: number | null
  selected_via_search: boolean
}

export type ResponseRead = {
  id: string
  external_id: string | null
  config_version: number
  completion: 'finished' | 'abandoned'
  completed_at: string
  /** This row's `completed_seq`, as a string because it is an int8. Feed it back as `since_seq`. */
  cursor: string
  /**
   * The node an `abandoned` response never came back for. Non-null here IS §5.4's
   * candidate-coverage read-out at the row level.
   */
  awaiting_node_id: string | null
  answers: AnswerRead[]
  /** `{node_id: {candidate_id: rendered_index}}` for the initial unfiltered render (§5.3). */
  positions: Record<string, Record<string, number>>
  metadata: Record<string, string>
  created_at: string
}

export type ResponsePage = {
  responses: ResponseRead[]
  count: number
  /**
   * Feed to `since_seq` on the next call. Echoes the caller's cursor when the page is
   * empty rather than resetting to null — a null there would restart the stream from the
   * beginning and re-deliver everything.
   */
  next_cursor: string | null
  /**
   * True when a row past this page already exists. A fact rather than the usual
   * `rows.length === limit` guess: the page is read with `LIMIT limit + 1` and the extra
   * row dropped, so a page that ends exactly on the boundary does not claim a next page
   * that is not there — and the poll hint below is allowed to trust it.
   */
  has_more: boolean
  /**
   * Whether a response is currently in flight — one that answered its first question and
   * has not yet resolved or been swept as abandoned (§5.4).
   *
   * This replaced an `is_final` flag, which could never legitimately be true and was a
   * holdover from a product where surveys ended. Its condition included `status !==
   * 'active'`, i.e. a paused form — but pausing is reversible, so an agent that stopped on
   * `is_final` would stop reading a stream that resumes the next day. An attribution form
   * is perpetual by design (§11.2): it has no terminal state, so no field may claim one.
   *
   * What an agent actually needs is the two facts underneath: is there more to read right
   * now (`has_more`), and should more be expected shortly (`open_responses`). Derived from
   * THE SAME SNAPSHOT as the page — computing it after the page reports "drained" about a
   * stream that grew in between.
   */
  open_responses: boolean
  /**
   * Advisory poll interval. Short while something is in flight, long once drained — so an
   * agent has a server-side answer to "when should I come back" instead of inventing one,
   * and so the cadence can be tuned here rather than in every caller.
   */
  next_check_hint_seconds: number
}

export type IdentityResponseRead = ResponseRead & {
  /**
   * The canonical response for this identity — §9's "first response per
   * (form_id, external_id)", the one the rollup books revenue against.
   */
  canonical: boolean
}

export type IdentityLookup = {
  external_id: string
  responses: IdentityResponseRead[]
  count: number
  /** Null only when the identity has no visible response at all. */
  canonical_response_id: string | null
  /**
   * True when this identity answered more than once. Surfaced rather than silently
   * hiding the extras (§9): a retake is allowed, so a caller joining our answer into
   * their user table needs to know there was a second one and which one we consider
   * canonical.
   */
  has_retakes: boolean
  /**
   * True when this identity has more responses than `limit` returned. The canonical one
   * is still first, so the answer a caller came for is never the row that got cut — but a
   * count that silently stops at the cap is a number a reader would take as complete.
   */
  truncated: boolean
}

/** Thrown for a malformed query string. Carries every problem, like the write path's errors. */
export class ReadQueryError extends Error {
  errors: string[]

  constructor(errors: string[]) {
    super('Invalid query parameters')
    this.name = 'ReadQueryError'
    this.errors = errors
  }
}

type ReadQuery =
  | { mode: 'cursor'; since: string; limit: number }
  | { mode: 'identity'; externalId: string; limit: number }

/**
 * The whole GET surface, dispatched on which parameter was sent. Returns null when the
 * form does not exist OR is not this account's — see requireOwnedForm; telling those two
 * apart is how an id space gets enumerated.
 */
export async function readResponses(
  accountId: string,
  routeFormId: string,
  params: URLSearchParams,
): Promise<ResponsePage | IdentityLookup | null> {
  const formId = readRouteFormId(routeFormId)

  // Same answer as an id that simply does not exist: an id that cannot be bound cannot
  // name a form, and a distinct status here would answer "is this well-formed" for a
  // caller who has proven nothing about the form.
  if (formId === null) {
    return null
  }

  const query = parseReadQuery(params)
  const form = await requireOwnedForm(accountId, formId)

  if (!form) {
    return null
  }

  // Repair before reading, for both modes. An unswept response is withheld from every
  // consumer by the visibility gate (§5.4), so a respondent who answered the channel
  // question and abandoned the follow-up is never delivered at all until something closes
  // the row. Bounded and rate-limited inside ensureSwept; failures there are swallowed, so
  // a read is never broken by the repair.
  await ensureSwept(formId)

  if (query.mode === 'identity') {
    return readIdentity(formId, query.externalId, query.limit)
  }

  return readPage(formId, form.status, query.since, query.limit)
}

/**
 * `?since_seq=…&limit=…` — the agent's delta read.
 *
 * `since_seq` is exclusive, so the cursor from the previous page never re-delivers its
 * last row. Absent means 0, i.e. "from the beginning": a first call needs no cursor.
 *
 * THE PAGE AND `open_responses` COME OUT OF ONE STATEMENT, and that is the whole reason
 * function looks the way it does. They used to be two round trips — page first, then a
 * probe for in-flight responses — and a response that completed between them was reported
 * as "the stream is finished" while sitting past the cursor the same call handed back. The
 * agent stops polling on that flag, so the row is not delayed, it is lost, and the field's
 * own docstring promises exactly the opposite. One statement is one snapshot, so at the
 * instant this is answered a response is either already in the page (delivered, cursor
 * advanced) or still open (`open_responses` true) — a PATCH is a single atomic statement,
 * there is no snapshot in which it is neither.
 *
 * The one window left: a POST that read `status = 'active'` just before the pause and
 * commits after this snapshot. Closing it needs a lock ordering the HTTP driver cannot
 * express in a read, and it is named here rather than left to be rediscovered.
 */
async function readPage(
  formId: string,
  status: string,
  since: string,
  limit: number,
): Promise<ResponsePage> {
  // Ids first, rows second. This half is the ordering-sensitive one and matches
  // idx_attribution_responses_cursor exactly; hydrating answers in the same statement
  // would put a LATERAL aggregate under the ORDER BY that has to produce the page.
  //
  // `limit + 1` makes `has_more` a fact rather than a guess, which the poll hint depends
  // on: "no undelivered row exists" has to mean no row past this page AND no row still to
  // complete, both read here.
  //
  // The open-response probe is an EXISTS against idx_attribution_responses_awaiting, run on
  // every cursor read including an active form's, where the answer is not used. That cost —
  // one index probe, no extra round trip — is deliberate: making it conditional means
  // making it a second statement, which is the bug this shape exists to remove.
  const rows = (await sql`
    WITH page AS (
      SELECT id, completed_seq
      FROM attribution_responses
      WHERE form_id = ${formId}
        AND completed_seq IS NOT NULL
        AND completed_seq > ${since}::bigint
      ORDER BY completed_seq
      LIMIT ${limit + 1}
    )
    SELECT
      COALESCE(
        (
          SELECT jsonb_agg(
            -- int8 as text. A cursor is an opaque token to its caller rather than a number
            -- to do arithmetic on, and Number() silently rounds past 2^53.
            jsonb_build_object('id', p.id, 'cursor', p.completed_seq::text)
            ORDER BY p.completed_seq
          )
          FROM page p
        ),
        '[]'::jsonb
      ) AS page,
      EXISTS (
        SELECT 1
        FROM attribution_responses
        WHERE form_id = ${formId}
          AND awaiting_node_id IS NOT NULL
          AND completed_at IS NULL
      ) AS open_responses
  `) as Array<{ page: unknown; open_responses: boolean }>

  const fetched = parseJsonValue<Array<{ id: string; cursor: string }>>(rows[0]?.page) ?? []
  const hasMore = fetched.length > limit
  const page = hasMore ? fetched.slice(0, limit) : fetched

  // A statement with no FROM always returns its one row, so the fallback is unreachable.
  // It defaults to "there is an open response" anyway, because the two directions do not
  // cost the same: erring toward false costs one wasted poll, erring toward true costs a
  // row nobody ever reads again.
  const openResponses = rows[0]?.open_responses ?? true

  const responses = await hydrate(
    formId,
    page.map((row) => row.id),
  )

  return {
    responses,
    count: responses.length,
    // The page's own last cursor, not the stream's maximum: handing back a maximum the
    // page never reached would skip every row between them.
    next_cursor: page[page.length - 1]?.cursor ?? (since === '0' ? null : since),
    has_more: hasMore,
    // A paused form still accepts PATCHes — ./responses declines to gate the follow-up on
    // status, so that a pause landing mid-response does not convert a real answer into an
    // abandonment — so an in-flight row on a paused form is a response that will still
    // appear, so it is reported rather than folded into a terminality claim.
    open_responses: openResponses,
    next_check_hint_seconds: hasMore ? 0 : openResponses ? 120 : 3600,
  }
}

/**
 * `?external_id=…` — §9's outbound direction: one identity, so a customer can join our
 * answer back into their own user table one row at a time.
 *
 * Ordered by `created_at`, NOT by `completed_seq`, and the first row is flagged canonical.
 * The two orders genuinely differ: an abandoned response is stamped complete by the sweep
 * (./responses sweepAbandoned) up to the abandonment threshold after it was created, so a
 * respondent who answered the channel question, walked away, and then retook the form
 * gets a LOWER completed_seq on the retake than on the attempt that came first. Ordering
 * on the cursor token would call the retake canonical and book the identity's revenue
 * against whichever channel they answered second.
 *
 * `completed_seq` breaks the tie, because two rows can share a created_at timestamp and
 * "canonical" has to be one row rather than whichever the planner returned first.
 */
async function readIdentity(
  formId: string,
  externalId: string,
  limit: number,
): Promise<IdentityLookup> {
  const page = (await sql`
    SELECT id
    FROM attribution_responses
    WHERE form_id = ${formId}
      AND external_id = ${externalId}
      AND completed_seq IS NOT NULL
    ORDER BY created_at, completed_seq
    LIMIT ${limit + 1}
  `) as Array<{ id: string }>

  // limit + 1, then drop the extra — the same reason readPage does it. `page.length ===
  // limit` reports an identity with exactly `limit` responses as having more, which is
  // the guess this file rejects everywhere else.
  const truncated = page.length > limit

  const responses = await hydrate(
    formId,
    page.slice(0, limit).map((row) => row.id),
  )

  return {
    external_id: externalId,
    responses: responses.map((response, index) => ({ ...response, canonical: index === 0 })),
    count: responses.length,
    canonical_response_id: responses[0]?.id ?? null,
    has_retakes: responses.length > 1,
    truncated,
  }
}

/**
 * Rows for a set of ids: answers, live-remap resolution, and snapshot labels, in one
 * statement.
 *
 * Shared by both reads so there is exactly one definition of what a response row looks
 * like. The alternative — folding this into each read's query — meant two copies of the
 * remap join, and the read that got a fix second would silently disagree with the other
 * about what an answer resolves to.
 *
 * Order is restored from `ids` rather than taken from the database: this statement is
 * unordered on purpose, because the two callers sort by different columns for reasons
 * spelled out at each of them.
 */
async function hydrate(formId: string, ids: string[]): Promise<ResponseRead[]> {
  if (ids.length === 0) {
    return []
  }

  const rows = (await sql`
    WITH page AS (
      SELECT id, external_id, config_version, completion, completed_at,
             completed_seq, awaiting_node_id, positions, metadata, created_at
      FROM attribution_responses
      -- form_id is redundant with the id list, which was itself selected per form. Kept
      -- because it costs nothing and this is the statement someone will copy.
      WHERE form_id = ${formId} AND id = ANY(${ids}::text[])
    ),
    resolved AS (
      SELECT
        a.response_id,
        a.node_id,
        a.kind,
        a.raw,
        a.candidate_id,
        a.position,
        a.selected_via_search,
        a.created_at,
        m.candidate_id AS remap_candidate_id,
        COALESCE(m.candidate_id, a.candidate_id) AS resolved_candidate_id
      FROM attribution_answers a
      JOIN page ON page.id = a.response_id
      -- §7's read-time resolution. raw_normalized is null for every kind except 'raw', and
      -- NULL = NULL is not true, so a picked candidate can never be caught by a remap of
      -- somebody's free text. Scoped to the form because node and candidate ids are both
      -- caller-defined (§5.1): every caller has a node named "channel".
      LEFT JOIN attribution_remaps m
        ON m.form_id = ${formId}
       AND m.node_id = a.node_id
       AND m.raw_normalized = a.raw_normalized
       AND m.revoked_at IS NULL
    ),
    -- Labels come from the config SNAPSHOTS, never from the live catalog (§4): a
    -- candidate's label can differ across versions, and resolving against the catalog
    -- would let a product-side rename rewrite what an old response says was rendered.
    -- Most recent version that contains the id wins, and that is stated in the payload's
    -- own field docs because a reader would otherwise assume the response's own version.
    labels AS (
      SELECT DISTINCT ON (node_id, candidate_id) node_id, candidate_id, label
      FROM (
        SELECT
          c.version,
          node->>'id' AS node_id,
          candidate->>'id' AS candidate_id,
          candidate->>'label' AS label
        FROM attribution_configs c
        CROSS JOIN LATERAL jsonb_array_elements(c.nodes) AS node
        CROSS JOIN LATERAL jsonb_array_elements(node->'candidates') AS candidate
        WHERE c.form_id = ${formId}
          -- Narrowing to the ids actually on this page. Without it every version's whole
          -- candidate set (up to 500 rows each, §5.1) is expanded on every cursor read.
          AND candidate->>'id' IN (
            SELECT resolved_candidate_id FROM resolved WHERE resolved_candidate_id IS NOT NULL
          )
      ) versions
      ORDER BY node_id, candidate_id, version DESC
    ),
    -- Aggregated here and joined below, rather than as a correlated subquery in the final
    -- SELECT. That is not a style preference: Postgres inlines a CTE referenced once, so
    -- with "labels" used inside a per-response subquery the whole config expansion above
    -- ran once PER ROW of the page — a hundred expansions of every version's candidate set
    -- for one cursor read. EXPLAIN showed it under SubPlan; grouping evaluates it once.
    answers AS (
      SELECT
        resolved.response_id,
        jsonb_agg(
          jsonb_build_object(
            'node_id', resolved.node_id,
            'kind', resolved.kind,
            'raw', resolved.raw,
            'candidate_id', resolved.candidate_id,
            'resolved_candidate_id', resolved.resolved_candidate_id,
            'remapped', resolved.remap_candidate_id IS NOT NULL,
            'resolved_label', labels.label,
            'position', resolved.position,
            'selected_via_search', resolved.selected_via_search
          )
          -- Answer order, which is question order: the root node is written by the POST
          -- and the follow-up by a later PATCH. node_id only breaks a tie that today's
          -- write path cannot produce, since each request records exactly one answer.
          ORDER BY resolved.created_at, resolved.node_id
        ) AS answers
      FROM resolved
      LEFT JOIN labels
        ON labels.node_id = resolved.node_id
       AND labels.candidate_id = resolved.resolved_candidate_id
      GROUP BY resolved.response_id
    )
    SELECT
      page.id,
      page.external_id,
      page.config_version,
      page.completion,
      page.completed_at,
      -- int8 as text. The driver would hand back a string anyway; casting says so, and a
      -- cursor is an opaque token to its caller rather than a number to do arithmetic on.
      page.completed_seq::text AS cursor,
      page.awaiting_node_id,
      page.positions,
      page.metadata,
      page.created_at,
      -- LEFT JOIN, and the COALESCE behind it, because a response with no answer row is
      -- structurally possible and must still be delivered: the cursor advances past it
      -- either way, so dropping it here would lose the row for good.
      COALESCE(answers.answers, '[]'::jsonb) AS answers
    FROM page
    LEFT JOIN answers ON answers.response_id = page.id
  `) as Array<{
    id: string
    external_id: string | null
    config_version: number
    completion: 'finished' | 'abandoned'
    completed_at: string
    cursor: string
    awaiting_node_id: string | null
    positions: unknown
    metadata: unknown
    created_at: string
    answers: unknown
  }>

  const byId = new Map(rows.map((row) => [row.id, row]))

  return ids.flatMap((id) => {
    const row = byId.get(id)

    return row ? [shapeResponse(row)] : []
  })
}

type RawAnswer = {
  node_id: string
  kind: AnswerRead['kind']
  raw: string | null
  candidate_id: string | null
  resolved_candidate_id: string | null
  remapped: boolean
  resolved_label: string | null
  position: number | null
  selected_via_search: boolean
}

function shapeResponse(row: {
  id: string
  external_id: string | null
  config_version: number
  completion: 'finished' | 'abandoned'
  completed_at: string
  cursor: string
  awaiting_node_id: string | null
  positions: unknown
  metadata: unknown
  created_at: string
  answers: unknown
}): ResponseRead {
  const answers = parseJsonValue<RawAnswer[]>(row.answers) ?? []

  return {
    id: row.id,
    external_id: row.external_id,
    config_version: row.config_version,
    completion: row.completion,
    completed_at: row.completed_at,
    cursor: row.cursor,
    awaiting_node_id: row.awaiting_node_id,
    answers: answers.map((answer) => ({
      node_id: answer.node_id,
      kind: answer.kind,
      raw: answer.raw,
      candidate_id: answer.candidate_id,
      resolved_candidate_id: answer.resolved_candidate_id,
      // Derived here rather than in SQL so `resolved_via` and `resolved_candidate_id`
      // cannot describe different things: a null resolution has no provenance to report.
      resolved_via:
        answer.resolved_candidate_id === null ? null : answer.remapped ? 'remap' : 'answer',
      resolved_label: answer.resolved_label,
      position: answer.position,
      selected_via_search: answer.selected_via_search,
    })),
    positions: parseJsonValue<Record<string, Record<string, number>>>(row.positions) ?? {},
    metadata: parseJsonValue<Record<string, string>>(row.metadata) ?? {},
    created_at: row.created_at,
  }
}

// `awaiting_node_id IS NOT NULL` in readPage's EXISTS is the whole population of open
// rows, not an approximation of it: submitResponse either completes a response or leaves it
// awaiting a node, never neither. If that ever stops being true, `open_responses` starts lying
// again and nothing here will say so.

// --- query parameters -------------------------------------------------------

export function parseReadQuery(params: URLSearchParams): ReadQuery {
  const errors: string[] = []
  const limit = readLimit(params.get('limit'), errors)
  const since = params.get('since_seq')
  const externalId = params.get('external_id')

  if (since !== null && externalId !== null) {
    // Two different reads with two different orderings and two different meanings of
    // "first row". Silently preferring one would give a caller a page they did not ask
    // for, and the cursor they fed back would then be a cursor into the other read.
    errors.push('since_seq and external_id are two different reads; send one or the other')
  }

  if (externalId !== null) {
    const value = readExternalId(externalId, errors)

    if (errors.length > 0 || value === null) {
      throw new ReadQueryError(errors)
    }

    return { mode: 'identity', externalId: value, limit }
  }

  const cursor = readSince(since, errors)

  if (errors.length > 0) {
    throw new ReadQueryError(errors)
  }

  return { mode: 'cursor', since: cursor, limit }
}

/**
 * Kept as a decimal string rather than parsed to a number: `completed_seq` is an int8, and
 * Number() silently rounds past 2^53, so a cursor round-tripped through a JS number could
 * skip rows that sit between the real value and the rounded one.
 */
function readSince(value: string | null, errors: string[]): string {
  if (value === null || value.trim().length === 0) {
    return '0'
  }

  const text = value.trim()

  if (!/^\d+$/.test(text)) {
    errors.push('since_seq must be a non-negative integer (the next_cursor of a prior call)')
    return '0'
  }

  if (BigInt(text) > MAX_BIGINT) {
    errors.push('since_seq is out of range')
    return '0'
  }

  return text
}

function readLimit(value: string | null, errors: string[]): number {
  if (value === null || value.trim().length === 0) {
    return DEFAULT_LIMIT
  }

  const text = value.trim()

  if (!/^\d+$/.test(text)) {
    errors.push('limit must be a positive integer')
    return DEFAULT_LIMIT
  }

  const limit = Number(text)

  if (limit < 1 || limit > MAX_LIMIT) {
    // Rejected rather than clamped. A clamp means an agent that asked for 5000 believes
    // it drained the stream when it read 500 rows and saw no error, and cursor reads are
    // the one path where quietly returning less than was asked for loses data.
    errors.push(`limit must be between 1 and ${MAX_LIMIT}`)
    return DEFAULT_LIMIT
  }

  return limit
}

function readExternalId(value: string, errors: string[]): string | null {
  const text = value.trim()

  if (text.length === 0) {
    errors.push('external_id must not be empty')
    return null
  }

  if (text.length > MAX_EXTERNAL_ID) {
    errors.push(`external_id must be at most ${MAX_EXTERNAL_ID} characters`)
    return null
  }

  if (CONTROL_CHARACTERS.test(text)) {
    errors.push('external_id must not contain control characters')
    return null
  }

  return text
}

/**
 * The form id off the route path, held to the same rules as any other bound id. It reads
 * like routing rather than input, which is how it went unvalidated on the write path
 * until a %00 in the URL turned a malformed request into a 500 with a raw driver error.
 * Errors are discarded because the caller turns a rejection into the same 404 a form that
 * does not exist gets.
 */
function readRouteFormId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const text = value.trim()

  if (text.length === 0 || text.length > MAX_ID || CONTROL_CHARACTERS.test(text)) {
    return null
  }

  return text
}
