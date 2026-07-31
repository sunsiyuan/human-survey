import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

import { requireOwnedForm } from '@/lib/auth'
import { parseJsonValue, sql } from '@/lib/db'

import { FormNotFoundError } from './config'

import { readInstant } from './window'

/**
 * The remap loop: free text in, a candidate mapping out, retroactively.
 *
 * Design contract: docs/design/attribution-pivot.md §7, and §10.4's `list_unresolved` /
 * `remap` pair — the two tools that make free text recoverable instead of merely stored.
 *
 * The one fact everything here is built around: **a mapping is not an edit.** Nothing in
 * this module touches a response or an answer row. The rollup resolves each answer as
 * COALESCE(live_remap.candidate_id, answers.candidate_id) at read time, joined on
 * (form_id, node_id, raw_normalized) WHERE revoked_at IS NULL, so inserting one row here
 * moves every completed response carrying that text in every window that contains it, in
 * every past and future rollup, with no backfill and nothing to recompute. Revoking it
 * moves them back. That is only true because the rollup is a query and not a cache (§7),
 * and it is why `resolved_responses` ships on the write paths: it is the exact number of
 * rows the caller just moved.
 *
 * Four things in here look like fussiness and are not:
 *
 * 1. NORMALIZATION HAPPENS IN POSTGRES, never in TypeScript. The key column is
 *    `attribution_answers.raw_normalized GENERATED ALWAYS AS (lower(btrim(raw)))`, and
 *    `btrim` with no second argument strips SPACES ONLY. JavaScript's `trim()` also
 *    strips tabs, newlines and every Unicode space, so normalizing here would produce a
 *    key that fails to match the stored value for any text a respondent pasted with a
 *    trailing newline — a mapping that resolves nothing, reported as success. So the
 *    caller's string is handed to `lower(btrim(...))` inside the statement, which is the
 *    same function evaluated by the same engine.
 * 2. The caller may send `raw` (a verbatim sample straight out of the unresolved list) or
 *    `raw_normalized`, and both take that identical path, because `lower(btrim(x))` is
 *    idempotent. An agent that read a value out of one endpoint can paste it into the
 *    other without knowing which one it has.
 * 3. `candidate_id` IS NOT VALIDATED against the current config, on purpose (§7): the
 *    candidate may have been dropped from the current version while history still needs
 *    the mapping. But an id present in NO version of the form is warned about, because
 *    the overwhelmingly likelier cause is a typo, and the failure mode of silence is a
 *    caller believing they fixed a number that never moved.
 * 4. Revocation is a soft delete. The row is the record that a number was once reported
 *    differently; deleting it makes two rollups of the same window disagree with no
 *    explanation available to anybody.
 */

export type RemapRow = {
  id: string
  node_id: string
  raw_normalized: string
  candidate_id: string
  note: string | null
  created_at: string
  revoked_at: string | null
}

export type RemapListEntry = RemapRow & {
  /** From the newest config version containing the id (§4). Null when no version has it. */
  candidate_label: string | null
  candidate_label_version: number | null
  /** Completed responses whose free text this mapping resolves right now. */
  resolved_responses: number
}

export type UnresolvedEntry = {
  node_id: string
  raw_normalized: string
  occurrences: number
  /** Distinct verbatim spellings behind this key, capped; `variant_count` is the truth. */
  variants: string[]
  variant_count: number
  first_seen: string
  last_seen: string
  mapped: boolean
  remap_id: string | null
  mapped_candidate_id: string | null
  mapped_candidate_label: string | null
}

export type UnresolvedPage = {
  form_id: string
  /** Filters on the response's completed_at, matching the rollup's window (§7). */
  window: { from: string | null; to: string | null }
  totals: {
    raw_responses: number
    mapped_responses: number
    unmapped_responses: number
    texts: number
    unmapped_texts: number
  }
  returned: number
  truncated: boolean
  entries: UnresolvedEntry[]
  notes: string[]
}

export type RemapList = {
  form_id: string
  returned: number
  truncated: boolean
  remaps: RemapListEntry[]
  notes: string[]
}

export type CreatedRemap = {
  remap: RemapRow
  resolved_responses: number
  candidate_label: string | null
  candidate_label_version: number | null
  warnings: string[]
}

export type RevokedRemap = {
  remap: RemapRow
  /** False when the mapping was already revoked, so a retry is not reported as a change. */
  revoked: boolean
  /** Completed responses this revocation returned to the unresolved list. */
  resolved_responses: number
  notes: string[]
}

/**
 * Carries the HTTP status, so every failure this module can produce has one definition
 * rather than being re-derived from a message at the route boundary. Same shape as
 * ResponseError in ./responses for the same reason.
 */
export class RemapError extends Error {
  status: number
  errors?: string[]

  constructor(status: number, message: string, errors?: string[]) {
    super(message)
    this.name = 'RemapError'
    this.status = status
    this.errors = errors
  }
}

/**
 * The partial unique index (form_id, node_id, raw_normalized) WHERE revoked_at IS NULL
 * refused a second live mapping for one string. It exists because two live remaps of the
 * same text double-count in the read-time join, so this is a real conflict and not a
 * retryable blip — hence a 409 naming the mapping already in place, rather than the 500 a
 * bare constraint violation would surface.
 */
export class RemapConflictError extends RemapError {
  existing: RemapRow | null

  constructor(existing: RemapRow | null) {
    super(
      409,
      existing
        ? `a live remap for this text already exists on node "${existing.node_id}" (${existing.id} → "${existing.candidate_id}"); revoke it first`
        : 'a live remap for this text already exists; it may have been revoked concurrently, in which case a retry will succeed',
    )
    this.name = 'RemapConflictError'
    this.existing = existing
  }
}

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500
const MAX_OFFSET = 100_000
const MAX_VARIANTS = 5

const MAX_ID = 128
const MAX_NOTE = 500

// The same cap the respondent write path puts on free text (lib/attribution/responses.ts
// MAX_RAW). A longer key is not merely unusual, it is unmatchable: no stored `raw` can
// exceed this, so the mapping could never resolve a single row.
const MAX_RAW = 500

// Two character classes cannot be stored, and are rejected rather than cleaned. Postgres
// refuses a NUL inside a text bind parameter, so one pasted into a body field becomes a
// 500 carrying a raw driver error instead of a validation failure. Lone surrogates are the
// same hazard with a different symptom: text parameters do not error, Node substitutes
// U+FFFD, which silently rewrites the remap key so that it matches a different bucket than
// the caller pasted. See hasControlCharacter and hasLoneSurrogate at the foot of the file.
//
// Both rules also exist, privately, in lib/attribution/responses.ts for the public
// endpoint's payload parser. They are duplicated rather than shared because that copy
// guards a different trust boundary; if a third caller needs them, the two should collapse
// into one primitive rather than becoming three.

/**
 * Free text awaiting a mapping, grouped by (node_id, raw_normalized) — the exact key the
 * remap table and the rollup's join use, so what an agent reads here is what it can act
 * on without transforming anything.
 *
 * Ordered by occurrence count descending: an agent working this list should reach the
 * twelve-occurrence entry before the singleton, because that is where the recoverable
 * signal is. The full grouping key breaks every tie, so the order is total and paging over
 * it can neither repeat an entry nor skip one — see the ORDER BY.
 *
 * Only completed responses are counted (`completed_seq IS NOT NULL`). An in-flight
 * response is not data yet (§5.4), and this list has to agree with the rollup, which
 * applies the same gate — a count here that the rollup does not reproduce is worse than
 * no count.
 *
 * The whole page is one statement. `totals` is computed from the same grouped set BEFORE
 * the include_mapped filter and the LIMIT, so the denominator a caller sees cannot drift
 * from the rows it accompanies, and a truncated page is visibly truncated instead of
 * looking like the whole story (§6.2's guard against numbers that read as complete).
 */
export async function listUnresolved(
  accountId: string,
  formId: string,
  params: URLSearchParams,
): Promise<UnresolvedPage> {
  const form = await assertOwnedForm(accountId, formId)

  const query = readUnresolvedQuery(params)

  const rows = (await sql`
    WITH raw_answers AS (
      SELECT a.node_id, a.raw, a.raw_normalized, r.completed_at
      FROM attribution_answers a
      JOIN attribution_responses r ON r.id = a.response_id
      WHERE r.form_id = ${form.id}
        AND a.kind = 'raw'
        AND r.completed_seq IS NOT NULL
        AND (${query.nodeId}::text IS NULL OR a.node_id = ${query.nodeId}::text)
        AND (${query.from}::timestamptz IS NULL OR r.completed_at >= ${query.from}::timestamptz)
        AND (${query.to}::timestamptz IS NULL OR r.completed_at < ${query.to}::timestamptz)
    ),
    grouped AS (
      SELECT
        a.node_id,
        a.raw_normalized,
        count(*)::int AS occurrences,
        -- Distinct spellings, alphabetical, capped. The cap is why variant_count ships
        -- next to it: a truncated sample that looks complete would have an agent conclude
        -- one creator was named two ways when they were named nine.
        (array_agg(DISTINCT a.raw ORDER BY a.raw))[1:${MAX_VARIANTS}::int] AS variants,
        count(DISTINCT a.raw)::int AS variant_count,
        min(a.completed_at) AS first_seen,
        max(a.completed_at) AS last_seen,
        m.id AS remap_id,
        m.candidate_id
      FROM raw_answers a
      -- The rollup's join, verbatim: form-scoped, live rows only. Form scoping is not
      -- optional — node ids and candidate ids are both caller-defined, so every account
      -- has a node named "channel" and an unscoped join would resolve one customer's free
      -- text with another's mapping.
      LEFT JOIN attribution_remaps m
        ON m.form_id = ${form.id}
       AND m.node_id = a.node_id
       AND m.raw_normalized = a.raw_normalized
       AND m.revoked_at IS NULL
      GROUP BY a.node_id, a.raw_normalized, m.id, m.candidate_id
    ),
    totals AS (
      SELECT
        COALESCE(sum(occurrences), 0)::int AS raw_responses,
        COALESCE(sum(occurrences) FILTER (WHERE remap_id IS NOT NULL), 0)::int AS mapped_responses,
        count(*)::int AS texts,
        (count(*) FILTER (WHERE remap_id IS NULL))::int AS unmapped_texts
      FROM grouped
    ),
    page AS (
      SELECT
        node_id,
        raw_normalized,
        occurrences,
        variants,
        variant_count,
        first_seen,
        last_seen,
        (remap_id IS NOT NULL) AS mapped,
        remap_id,
        candidate_id AS mapped_candidate_id
      FROM grouped
      WHERE ${query.includeMapped}::boolean OR remap_id IS NULL
      -- node_id is in the ordering because without it this is not a TOTAL order, and
      -- LIMIT/OFFSET over a non-total order is not paging — it is sampling. raw_normalized
      -- is unique only WITHIN a node (the grouping key above is (node_id, raw_normalized)),
      -- so two nodes carrying the same text with the same occurrence count and the same
      -- last_seen tie completely, and the planner is free to order them differently on the
      -- statement that returns offset 0 than on the one that returns offset 100: one entry
      -- comes back twice and another is never seen. An agent working this list to exhaustion
      -- would silently never be offered the second one.
      ORDER BY occurrences DESC, last_seen DESC, node_id, raw_normalized
      LIMIT ${query.limit} OFFSET ${query.offset}
    )
    SELECT
      (SELECT row_to_json(t) FROM totals t) AS totals,
      -- Re-stated inside json_agg: a subquery's ORDER BY is not guaranteed to survive
      -- aggregation, and the page would then arrive in whatever order the plan produced.
      -- It has to be the SAME total order, or the page is stable while its contents are not.
      (
        SELECT COALESCE(
          json_agg(p ORDER BY p.occurrences DESC, p.last_seen DESC, p.node_id, p.raw_normalized),
          '[]'::json
        )
        FROM page p
      ) AS entries
  `) as Array<{ totals: unknown; entries: unknown }>

  const totals = parseJsonValue<{
    raw_responses: number
    mapped_responses: number
    texts: number
    unmapped_texts: number
  }>(rows[0]?.totals) ?? {
    raw_responses: 0,
    mapped_responses: 0,
    texts: 0,
    unmapped_texts: 0,
  }

  const entries = parseJsonValue<UnresolvedEntry[]>(rows[0]?.entries) ?? []

  // Only the mapped rows carry a candidate, and only include_mapped=1 returns any, so
  // this round trip is skipped on the ordinary call.
  const labels = await describeCandidates(
    form.id,
    entries.map((entry) => entry.mapped_candidate_id).filter((id): id is string => id !== null),
  )

  for (const entry of entries) {
    entry.mapped_candidate_label = entry.mapped_candidate_id
      ? labels.get(entry.mapped_candidate_id)?.label ?? null
      : null
  }

  const matchingTexts = query.includeMapped ? totals.texts : totals.unmapped_texts

  const notes = [
    'occurrences count completed responses only (§5.4): an in-flight response is not data yet, and the rollup applies the same gate.',
    'window filters on the response completed_at; `to` is exclusive, so consecutive windows never double-count a response.',
    query.includeMapped
      ? 'entries already covered by a live remap are included and flagged with `mapped`.'
      : 'entries already covered by a live remap are excluded; pass include_mapped=1 to see them.',
  ]

  if (entries.some((entry) => entry.mapped_candidate_label !== null)) {
    notes.push(
      'candidate labels come from the newest config version containing the id (§4), which can differ from an older version’s label for the same candidate.',
    )
  }

  return {
    form_id: form.id,
    window: { from: query.from, to: query.to },
    totals: {
      raw_responses: totals.raw_responses,
      mapped_responses: totals.mapped_responses,
      unmapped_responses: totals.raw_responses - totals.mapped_responses,
      texts: totals.texts,
      unmapped_texts: totals.unmapped_texts,
    },
    returned: entries.length,
    truncated: matchingTexts > query.offset + entries.length,
    entries,
    notes,
  }
}

/**
 * Create a mapping. §7's whole point: this is the write that fixes history.
 *
 * Insert-first rather than SELECT-then-insert. A pre-flight existence check is a separate
 * round trip outside any transaction, so an identical concurrent create still slips past
 * it and dies on the unique index — a 500 for what is a 409. ON CONFLICT DO NOTHING makes
 * the race the conflict it always was, and the existing row is looked up only on the path
 * where we already know there is one.
 */
export async function createRemap(
  accountId: string,
  formId: string,
  body: unknown,
): Promise<CreatedRemap> {
  const form = await assertOwnedForm(accountId, formId)

  const input = readRemapInput(body)
  const id = nanoid(12)

  // lower(btrim(...)) is applied HERE, by Postgres, because that is the definition
  // attribution_answers.raw_normalized is generated with. See this module's header: a
  // JavaScript trim() strips whitespace btrim() does not, and the mismatch shows up as a
  // mapping that silently resolves nothing.
  const inserted = (await sql`
    INSERT INTO attribution_remaps (id, form_id, node_id, raw_normalized, candidate_id, note)
    VALUES (
      ${id},
      ${form.id},
      ${input.nodeId},
      lower(btrim(${input.rawInput}::text)),
      ${input.candidateId},
      ${input.note}
    )
    ON CONFLICT (form_id, node_id, raw_normalized) WHERE revoked_at IS NULL DO NOTHING
    RETURNING id, node_id, raw_normalized, candidate_id, note, created_at, revoked_at
  `) as RemapRow[]

  const remap = inserted[0]

  if (!remap) {
    throw new RemapConflictError(await liveRemap(form.id, input.nodeId, input.rawInput))
  }

  const [counts, labels, nodeIds] = await Promise.all([
    resolvedCounts(form.id, [remap]),
    describeCandidates(form.id, [remap.candidate_id]),
    formNodeIds(form.id),
  ])

  const resolved = counts.get(countKey(remap)) ?? 0
  const described = labels.get(remap.candidate_id)
  const warnings: string[] = []

  if (!described) {
    // Not an error: §7 keeps candidate_id free of a foreign key precisely so a candidate
    // dropped from the current config can still be mapped to. But a typo lands in exactly
    // the same place, and a mapping nobody can see is a mapping nobody can fix.
    warnings.push(
      `candidate_id "${remap.candidate_id}" matches no candidate in any config version of this form; that is legitimate for a candidate dropped from the current config, and is otherwise a typo that will resolve free text to a bucket the rollup cannot label`,
    )
  } else if (!described.nodeIds.includes(remap.node_id)) {
    warnings.push(
      `candidate_id "${remap.candidate_id}" appears on node ${described.nodeIds
        .map((node) => `"${node}"`)
        .join(', ')}, not on "${remap.node_id}"`,
    )
  }

  if (!nodeIds.has(remap.node_id)) {
    warnings.push(
      `node_id "${remap.node_id}" is not a node in any config version of this form, so no answer can ever carry it`,
    )
  }

  if (resolved === 0) {
    // The mapping is stored and will apply the moment matching text arrives, so this is a
    // warning and not a rejection. It is here because "I fixed it and the number did not
    // move" is the one outcome this endpoint must never report as an unqualified success.
    warnings.push(
      'this mapping currently resolves 0 completed responses; check node_id and the exact text against GET /api/attribution/forms/{id}/unresolved',
    )
  }

  return {
    remap,
    resolved_responses: resolved,
    candidate_label: described?.label ?? null,
    candidate_label_version: described?.version ?? null,
    warnings,
  }
}

/**
 * Existing live mappings. Revoked ones are behind include_revoked=1 rather than hidden,
 * because "why did this number change last month" is answerable only from the revoked
 * rows.
 */
export async function listRemaps(
  accountId: string,
  formId: string,
  params: URLSearchParams,
): Promise<RemapList> {
  const form = await assertOwnedForm(accountId, formId)

  const query = readRemapListQuery(params)

  // One row past the page, then dropped. `truncated` is then a fact rather than the usual
  // rows.length === limit guess, which reports a lie on the one page that ends exactly on
  // the boundary and sends an agent looking for a page that does not exist.
  const fetched = (await sql`
    SELECT id, node_id, raw_normalized, candidate_id, note, created_at, revoked_at
    FROM attribution_remaps
    WHERE form_id = ${form.id}
      AND (${query.includeRevoked}::boolean OR revoked_at IS NULL)
    ORDER BY created_at DESC, id
    LIMIT ${query.limit + 1} OFFSET ${query.offset}
  `) as RemapRow[]

  const truncated = fetched.length > query.limit
  const rows = truncated ? fetched.slice(0, query.limit) : fetched

  const [counts, labels] = await Promise.all([
    resolvedCounts(form.id, rows),
    describeCandidates(
      form.id,
      rows.map((row) => row.candidate_id),
    ),
  ])

  const remaps: RemapListEntry[] = rows.map((row) => {
    const described = labels.get(row.candidate_id)

    return {
      ...row,
      candidate_label: described?.label ?? null,
      candidate_label_version: described?.version ?? null,
      resolved_responses: counts.get(countKey(row)) ?? 0,
    }
  })

  return {
    form_id: form.id,
    returned: remaps.length,
    truncated,
    remaps,
    notes: [
      'resolved_responses counts the completed responses this mapping resolves right now. The rollup joins this table at read time (§7), so creating or revoking a mapping moves exactly that many rows in every window containing them, with no backfill.',
      'candidate_label comes from the newest config version containing the id (§4); null means no version of this form contains it, which the create path warns about.',
      query.includeRevoked
        ? 'revoked mappings are included; a revoked row still resolves nothing — it is kept as the record that a number was once reported differently.'
        : 'revoked mappings are excluded; pass include_revoked=1 to see them.',
    ],
  }
}

/**
 * Revoke. Soft, always (§7): the row is the record that a number was once reported
 * differently, and a hard delete makes two rollups of the same window disagree with
 * nothing left to explain why.
 *
 * Idempotent. A second call reports `revoked: false` and the original timestamp rather
 * than a 409 — DELETE that fails on a retry is a worse contract for an agent, and moving
 * `revoked_at` forward would rewrite when the mapping stopped applying.
 */
export async function revokeRemap(
  accountId: string,
  formId: string,
  remapId: string,
): Promise<RevokedRemap> {
  const form = await assertOwnedForm(accountId, formId)

  const id = readString(remapId, 'remap id', { required: true, max: MAX_ID }, [])

  // Same answer as an id that does not exist. An id that cannot be stored cannot name a
  // remap, and the caller learns nothing either way.
  if (id === null) {
    throw new RemapError(404, 'Remap not found')
  }

  // form_id is in the WHERE clause, not just in the ownership check above, so a remap id
  // alone is never sufficient to revoke someone else's mapping.
  const updated = (await sql`
    UPDATE attribution_remaps
    SET revoked_at = now()
    WHERE id = ${id}
      AND form_id = ${form.id}
      AND revoked_at IS NULL
    RETURNING id, node_id, raw_normalized, candidate_id, note, created_at, revoked_at
  `) as RemapRow[]

  const remap = updated[0] ?? (await findRemap(form.id, id))

  if (!remap) {
    throw new RemapError(404, 'Remap not found')
  }

  const counts = await resolvedCounts(form.id, [remap])
  const revoked = updated.length > 0

  return {
    remap,
    revoked,
    resolved_responses: counts.get(countKey(remap)) ?? 0,
    notes: [
      revoked
        ? 'resolved_responses is the number of completed responses this revocation just returned to the unresolved list, in every past window as well as future ones — the rollup joins live remaps at read time, so nothing was backfilled.'
        : 'this mapping was already revoked; revoked_at is unchanged, because moving it would rewrite when the mapping stopped applying.',
      'the row is kept rather than deleted, so a rollup of an old window can still be explained.',
    ],
  }
}

/** Map the errors this module throws onto responses, so all three routes agree. */
export function remapErrorResponse(error: unknown): Response | null {
  if (error instanceof RemapConflictError) {
    return NextResponse.json(
      { error: error.message, existing: error.existing },
      { status: error.status },
    )
  }

  if (error instanceof RemapError) {
    return NextResponse.json(
      error.errors && error.errors.length > 0
        ? { error: error.message, errors: error.errors }
        : { error: error.message },
      { status: error.status },
    )
  }

  if (error instanceof FormNotFoundError) {
    // One answer for "no such form" and "not your form" — see requireOwnedForm.
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  return null
}

// --- ownership --------------------------------------------------------------

/**
 * The authorization boundary for every function in this module. Conflates "does not
 * exist" with "is not yours", because telling them apart lets anyone enumerate which form
 * ids are real.
 *
 * The route's `id` segment is held to the same rules as any id in a body first. It looks
 * like routing rather than input — which is how the same value went unvalidated on the
 * respondent endpoint until it did not: /forms/%00/remaps decodes to a NUL, which Postgres
 * refuses at bind time, so a malformed URL answered with a 500 and a raw driver error
 * instead of the 404 it deserves.
 */
async function assertOwnedForm(accountId: string, formId: string) {
  const id = readString(formId, 'form id', { required: true, max: MAX_ID }, [])

  if (id === null) {
    throw new FormNotFoundError()
  }

  const form = await requireOwnedForm(accountId, id)

  if (!form) {
    throw new FormNotFoundError()
  }

  return form
}

// --- shared reads -----------------------------------------------------------

/**
 * How many completed responses each mapping resolves.
 *
 * One definition, shared by the create, list and revoke paths, so the number cannot mean
 * three subtly different things. The population matches `listUnresolved` and the rollup:
 * free-text answers on completed responses, form-scoped. Duplicates per external_id are
 * NOT collapsed here — §9's first-response-per-identity rule is a revenue rule, and this
 * is a response count.
 */
async function resolvedCounts(
  formId: string,
  keys: Array<{ node_id: string; raw_normalized: string }>,
): Promise<Map<string, number>> {
  if (keys.length === 0) {
    return new Map()
  }

  const rows = (await sql`
    SELECT a.node_id, a.raw_normalized, count(*)::int AS resolved_responses
    FROM attribution_answers a
    JOIN attribution_responses r ON r.id = a.response_id
    WHERE r.form_id = ${formId}
      AND a.kind = 'raw'
      AND r.completed_seq IS NOT NULL
      AND (a.node_id, a.raw_normalized) IN (
        SELECT * FROM unnest(
          ${keys.map((key) => key.node_id)}::text[],
          ${keys.map((key) => key.raw_normalized)}::text[]
        )
      )
    GROUP BY a.node_id, a.raw_normalized
  `) as Array<{ node_id: string; raw_normalized: string; resolved_responses: number }>

  return new Map(rows.map((row) => [countKey(row), row.resolved_responses]))
}

/** JSON rather than a delimiter, so no node id or free text can forge a collision. */
function countKey(key: { node_id: string; raw_normalized: string }): string {
  return JSON.stringify([key.node_id, key.raw_normalized])
}

type CandidateDescriptor = {
  /** Null only for a snapshot missing the field, which the validator makes impossible. */
  label: string | null
  version: number
  nodeIds: string[]
}

/**
 * Labels for candidate ids, read out of the CONFIG SNAPSHOTS and never the live catalog
 * (§4, §5.5). A candidate's label can differ across versions, so the one used is from the
 * most recent version that contains the id — and `version` ships with it so a caller can
 * see which. Resolving against the live catalog instead would let a product-side rename
 * rewrite what an old rollup claims was shown.
 *
 * Absence is meaningful: it is the signal that `createRemap` warns on.
 */
async function describeCandidates(
  formId: string,
  candidateIds: string[],
): Promise<Map<string, CandidateDescriptor>> {
  const ids = [...new Set(candidateIds)]

  if (ids.length === 0) {
    return new Map()
  }

  const rows = (await sql`
    SELECT
      cand->>'id' AS candidate_id,
      -- The label from the newest version holding this id. max(version) below names it.
      (array_agg(cand->>'label' ORDER BY c.version DESC))[1] AS label,
      max(c.version)::int AS label_version,
      array_agg(DISTINCT node->>'id') AS node_ids
    FROM attribution_configs c
    CROSS JOIN LATERAL jsonb_array_elements(c.nodes) AS node
    -- COALESCE because jsonb_array_elements aborts the whole statement on a non-array.
    -- The validator guarantees every node has a non-empty candidates array, so this only
    -- fires on a snapshot written by something other than configureForm — where losing a
    -- label beats failing the request.
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(node->'candidates', '[]'::jsonb)) AS cand
    WHERE c.form_id = ${formId}
      AND cand->>'id' = ANY(${ids}::text[])
    GROUP BY cand->>'id'
  `) as Array<{
    candidate_id: string
    label: string | null
    label_version: number
    node_ids: string[]
  }>

  // The label is passed through even when null rather than defaulted to the id: a caller
  // that cannot tell a real label from an id echoed back at it will publish the id as a
  // creator's name.
  return new Map(
    rows.map((row) => [
      row.candidate_id,
      { label: row.label, version: row.label_version, nodeIds: row.node_ids },
    ]),
  )
}

/** Every node id this form has ever had. A remap naming anything else can match nothing. */
async function formNodeIds(formId: string): Promise<Set<string>> {
  const rows = (await sql`
    SELECT DISTINCT node->>'id' AS node_id
    FROM attribution_configs c
    CROSS JOIN LATERAL jsonb_array_elements(c.nodes) AS node
    WHERE c.form_id = ${formId}
  `) as Array<{ node_id: string }>

  return new Set(rows.map((row) => row.node_id))
}

/** The live mapping blocking a create. Normalized by the same expression as the insert. */
async function liveRemap(
  formId: string,
  nodeId: string,
  rawInput: string,
): Promise<RemapRow | null> {
  const rows = (await sql`
    SELECT id, node_id, raw_normalized, candidate_id, note, created_at, revoked_at
    FROM attribution_remaps
    WHERE form_id = ${formId}
      AND node_id = ${nodeId}
      AND raw_normalized = lower(btrim(${rawInput}::text))
      AND revoked_at IS NULL
    LIMIT 1
  `) as RemapRow[]

  return rows[0] ?? null
}

async function findRemap(formId: string, remapId: string): Promise<RemapRow | null> {
  const rows = (await sql`
    SELECT id, node_id, raw_normalized, candidate_id, note, created_at, revoked_at
    FROM attribution_remaps
    WHERE id = ${remapId} AND form_id = ${formId}
    LIMIT 1
  `) as RemapRow[]

  return rows[0] ?? null
}

// --- input ------------------------------------------------------------------

type RemapInput = {
  nodeId: string
  candidateId: string
  /** Verbatim as the caller sent it; normalized by Postgres inside the statement. */
  rawInput: string
  note: string | null
}

function readRemapInput(body: unknown): RemapInput {
  if (!isRecord(body)) {
    throw new RemapError(400, 'Request body must be an object')
  }

  const errors: string[] = []
  const nodeId = readString(body.node_id, 'node_id', { required: true, max: MAX_ID }, errors)
  const candidateId = readString(
    body.candidate_id,
    'candidate_id',
    { required: true, max: MAX_ID },
    errors,
  )
  const note = readString(body.note, 'note', { max: MAX_NOTE }, errors)
  const rawInput = readRawKey(body, errors)

  if (errors.length > 0 || nodeId === null || candidateId === null || rawInput === null) {
    throw new RemapError(400, 'Invalid remap payload', errors)
  }

  return { nodeId, candidateId, rawInput, note }
}

/**
 * The text to map, from either `raw_normalized` or `raw`.
 *
 * Deliberately NOT trimmed. `lower(btrim(...))` in the statement is the only
 * normalization, because it is the one the generated column uses; trimming here first
 * would strip tabs and newlines that btrim leaves in place, producing a key that matches
 * nothing while looking correct in the response.
 */
function readRawKey(body: Record<string, unknown>, errors: string[]): string | null {
  const supplied = (['raw_normalized', 'raw'] as const).filter(
    (key) => body[key] !== undefined && body[key] !== null,
  )

  if (supplied.length !== 1) {
    errors.push(
      supplied.length === 0
        ? 'one of raw_normalized or raw is required: the normalized key, or a verbatim sample which is normalized the same way'
        : 'send exactly one of raw_normalized or raw, not both',
    )
    return null
  }

  const where = supplied[0]
  const value = body[where]

  if (typeof value !== 'string') {
    errors.push(`${where} must be a string`)
    return null
  }

  // JS trim() only decides emptiness here, never the stored value: it is a superset of
  // btrim, so a string that is empty after trim() normalizes to whitespace-only, and no
  // storable free text can normalize to that.
  if (value.trim().length === 0) {
    errors.push(`${where} must not be empty`)
    return null
  }

  if (value.length > MAX_RAW) {
    errors.push(
      `${where} must be at most ${MAX_RAW} characters, which is the cap on stored free text; a longer key can match no answer`,
    )
    return null
  }

  const unstorable = unstorableReason(value)

  if (unstorable) {
    errors.push(`${where} must not contain ${unstorable}`)
    return null
  }

  return value
}

// --- query parameters -------------------------------------------------------

type UnresolvedQuery = {
  nodeId: string | null
  from: string | null
  to: string | null
  includeMapped: boolean
  limit: number
  offset: number
}

function readUnresolvedQuery(params: URLSearchParams): UnresolvedQuery {
  const errors: string[] = []
  const query: UnresolvedQuery = {
    nodeId: readString(params.get('node_id'), 'node_id', { max: MAX_ID }, errors),
    from: readInstant(params.get('from'), 'from', errors),
    to: readInstant(params.get('to'), 'to', errors),
    includeMapped: readBoolean(params.get('include_mapped'), 'include_mapped', errors),
    limit: readLimit(params.get('limit'), errors),
    offset: readOffset(params.get('offset'), errors),
  }

  if (query.from !== null && query.to !== null && query.from >= query.to) {
    errors.push('from must be before to')
  }

  if (errors.length > 0) {
    throw new RemapError(400, 'Invalid query', errors)
  }

  return query
}

function readRemapListQuery(params: URLSearchParams) {
  const errors: string[] = []
  const query = {
    includeRevoked: readBoolean(params.get('include_revoked'), 'include_revoked', errors),
    limit: readLimit(params.get('limit'), errors),
    offset: readOffset(params.get('offset'), errors),
  }

  if (errors.length > 0) {
    throw new RemapError(400, 'Invalid query', errors)
  }

  return query
}

/**
 * `?include_mapped=1`. An unrecognized value is an error rather than a silent false: a
 * caller who typed `include_mapped=yes please` and got the default back would believe
 * they had seen every entry.
 */
function readBoolean(value: string | null, where: string, errors: string[]): boolean {
  if (value === null || value === '') {
    return false
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === '1' || normalized === 'true') {
    return true
  }

  if (normalized === '0' || normalized === 'false') {
    return false
  }

  errors.push(`${where} must be 1, 0, true or false`)
  return false
}

function readLimit(value: string | null, errors: string[]): number {
  if (value === null || value.trim().length === 0) {
    return DEFAULT_LIMIT
  }

  const limit = Number(value)

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    errors.push(`limit must be an integer between 1 and ${MAX_LIMIT}`)
    return DEFAULT_LIMIT
  }

  return limit
}

function readOffset(value: string | null, errors: string[]): number {
  if (value === null || value.trim().length === 0) {
    return 0
  }

  const offset = Number(value)

  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    errors.push(`offset must be an integer between 0 and ${MAX_OFFSET}`)
    return 0
  }

  return offset
}

// --- primitives -------------------------------------------------------------

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

  const unstorable = unstorableReason(text)

  if (unstorable) {
    errors.push(`${where} must not contain ${unstorable}`)
    return null
  }

  return text
}

function unstorableReason(value: string): string | null {
  if (hasControlCharacter(value)) {
    return 'control characters'
  }

  if (hasLoneSurrogate(value)) {
    return 'unpaired UTF-16 surrogates'
  }

  return null
}

/**
 * C0 and DEL, except tab, newline and carriage return — free text is pasted out of real
 * pages and legitimately carries those three.
 *
 * Written as code-point arithmetic rather than a character class because the class would
 * have to be spelled with escapes, and an escape that does not survive an edit turns this
 * guard into a regex that matches the literal characters it was meant to exclude.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)

    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) {
      return true
    }
  }

  return false
}

/** Either surrogate half without its partner. */
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
