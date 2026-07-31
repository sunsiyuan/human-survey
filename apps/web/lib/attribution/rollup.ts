import { requireOwnedForm } from '@/lib/auth'
import { parseJsonValue, sql } from '@/lib/db'

import { FormNotFoundError } from './config'

import { readInstant } from './window'

/**
 * The attribution rollup: channel × heads and channel × revenue, computed at read time.
 *
 * Design contract: docs/design/attribution-pivot.md §7 (rollup, raw, retroactive
 * remapping), §9 (external_id as the join key), §10.4 (the MCP read/write loop).
 *
 * Seven things in here are load-bearing and read like preference. Each is a decision the
 * design doc forced, with the failure it prevents:
 *
 * 1. THE AGGREGATION IS IN SQL, WITH THE WINDOW IN THE WHERE CLAUSE. The pre-pivot
 *    results endpoint SELECTed every response row with no LIMIT and aggregated in JS.
 *    An attribution form is a perpetual stream (§11.2) embedded in someone's payment
 *    flow for months, so that is not a style question — it is a query that gets slower
 *    every day it runs and never errors. What this module does in TypeScript is
 *    arithmetic over at most (nodes × candidates) already-aggregated rows.
 *
 * 2. THE RESOLVED CANDIDATE IS COMPUTED AGAINST THE CURRENT REMAP TABLE, EVERY READ.
 *    `COALESCE(remap.candidate_id, answers.candidate_id)`, joined on
 *    (form_id, node_id, raw_normalized) WHERE revoked_at IS NULL. This is the only
 *    reason one mapping fixes two months of history at once (§7); a cached or
 *    write-time-aggregated rollup would fix nothing that had already been counted.
 *    Nothing here writes, and nothing here discards `raw`.
 *
 * 3. ONLY COMPLETED RESPONSES COUNT — `completed_seq IS NOT NULL`. An in-flight
 *    response is not data yet, and §5.4's visibility gate exists precisely so that no
 *    reader has to guess about half-finished rows. A response swept as `abandoned` IS
 *    complete and does count: its channel answer is real, which is also the rule §10.3
 *    bills on.
 *
 * 4. THE DENOMINATOR IS EXPLICIT AND SHIPS IN THE PAYLOAD. `share` is over every
 *    completed response that answered that node, so the resolved rows sum to LESS than
 *    one and the remainder is the `unresolved` block. A reader who has to infer whether
 *    "31%" excludes the don't-knows will infer wrong, and a number nobody can locate the
 *    denominator of is worse than no number (§6.2).
 *
 * 5. REVENUE IS BOOKED ONCE PER RESPONSE, AND APPEARS ONCE IN THE PAYLOAD. Two rules,
 *    and only the first of them used to hold. §9: the FIRST response per
 *    (form_id, external_id) is the only one that may book money — the column is
 *    deliberately not unique because a retake is allowed, so without this the second
 *    answer from one identity books the same money to a second channel. Note the
 *    asymmetry, called out in `notes`: a retake still counts in `responses` (it is a
 *    real answer from a real person) and books no revenue.
 *
 *    The second rule is new and fixes a silent multiplication. The totals now ship in a
 *    top-level `revenue` block computed once per response, and per-row revenue survives
 *    ONLY on rows of the root node (`revenue_cents` and `paying_responses` are null
 *    elsewhere). Before that, one response's money was repeated on every node it
 *    answered, so any aggregation across nodes multiplied revenue by the number of
 *    questions the respondent answered — and every row still looked plausible. Null
 *    rather than 0 on a follow-up row because 0 is a claim ("this creator earned
 *    nothing") while the truth is that the money is booked on the channel row of the
 *    very same responses.
 *
 * 6. LABELS COME FROM THE CONFIG SNAPSHOTS, NEVER THE LIVE CATALOG (§4). A candidate's
 *    label can differ across versions, so the label used is the one from the most recent
 *    version that contains that candidate id. Resolving against the live catalog would
 *    let a product-side rename rewrite what an old rollup claims was shown. A remap
 *    target that exists only on a DIFFERENT node of the same form is labelled from that
 *    node, with `label_from_node_id` naming where it came from: the remaps endpoint
 *    already reports that candidate's label and warns about the node mismatch (./remap,
 *    createRemap), and two endpoints disagreeing about whether a label exists at all is
 *    worse than either answer on its own.
 *
 * 7. THE TWO FOLLOW-UP READ-OUTS ARE DIFFERENT NUMBERS AND BOTH SHIP.
 *    `followup_unresolved` is §5.4's candidate-coverage read-out: of the picks that
 *    opened a follow-up, the fraction that did not end in a resolved candidate — never
 *    returned, dont_remember, skipped, or free text with no live remap.
 *    `followup_abandoned` is strictly the fraction that never came back at all. One
 *    field named `followup_abandoned` used to compute the first and return 0.8 where
 *    true abandonment was 0.2. Neither is derivable from the other, and a number
 *    labelled one thing while computing another is worse than a missing number, because
 *    the reader acts on it.
 *
 *    Both are ARRAYS keyed by explicit fields, never a map keyed on
 *    `${node_id}:${candidate_id}`. Node ids and candidate ids are caller-defined
 *    arbitrary strings (§5.1), so a candidate id of `tiktok:jade` collides with the
 *    (`tiktok`, `jade`) pair and Object.fromEntries silently keeps one of them — the
 *    same class of bug as the Object.prototype hazard already fixed in ./order.
 *
 * What is deliberately absent: `share_corrected`, `position_effect` and `calibration`
 * are all null in v1. See NOTES below — they are returned as explicit nulls rather than
 * omitted, so their absence is visible instead of mysterious.
 */

export type RollupGrain = 'node' | 'candidate'
export type RollupMetric = 'responses' | 'revenue'

export type RollupQuery = {
  formId: string
  by: RollupGrain
  metric: RollupMetric
  /** Inclusive lower bound on `attribution_responses.completed_at`, or null for unbounded. */
  from: string | null
  /** EXCLUSIVE upper bound on the same column, or null for unbounded. */
  to: string | null
}

export type RollupRow = {
  node_id: string
  /** Null only at the `by=node` grain, where candidates are rolled together. */
  candidate_id: string | null
  /**
   * From the most recent config version containing the id (§4), preferring a version
   * that holds it on THIS node. Null only when no version of this form contains the id
   * at all — a remap target that was never a candidate here, which ./remap warns about
   * at create time.
   */
  label: string | null
  /**
   * Non-null when `label` had to be read off a different node of this form, and names
   * that node. Only ever happens for a remap target: §7 deliberately keeps the target
   * free of a foreign key, so an agent can map free text on `channel` to a candidate
   * that only ever existed on `creator`.
   */
  label_from_node_id: string | null
  responses: number
  /** `responses / denominator.per_node[node_id]`. */
  share: number
  /** Always null in v1 (§6.2). */
  share_corrected: null
  /**
   * Null on every row that is not the root node's: revenue is a property of the
   * response, and the response's money is booked on its channel answer. See the
   * top-level `revenue` block for the total, and the header's decision 5 for why this is
   * not 0.
   */
  revenue_cents: number | null
  /** Null on the same rows and for the same reason as `revenue_cents`. */
  paying_responses: number | null
  /** How many of `responses` arrived as free text a live remap resolved. */
  resolved_by_remap: number
}

export type RollupUnresolved = {
  raw: number
  dont_remember: number
  skipped: number
}

/**
 * One pick that opened a follow-up, per (node, candidate, follow-up node).
 *
 * The follow-up node is part of the key rather than dropped, because §10.4 has an agent
 * retune which channels expand every month: the same candidate can expand to one node in
 * version 3 and another in version 7, and averaging two different follow-ups into one
 * rate would describe a question nobody was ever asked. Explicit fields rather than a
 * composite string key — see the header's decision 7.
 */
export type FollowupKey = {
  node_id: string
  candidate_id: string
  /** The node this pick revealed, out of the config version the respondent saw. */
  follow_node_id: string
  /** Completed responses that picked this candidate and opened this follow-up. */
  picks: number
}

/** §5.4's candidate-coverage read-out: picks whose follow-up produced no candidate. */
export type FollowupUnresolvedRow = FollowupKey & {
  /**
   * Picks whose follow-up did not end in a resolved candidate: never returned,
   * dont_remember, skipped, or free text with no live remap.
   */
  unresolved: number
  /** `unresolved / picks`. */
  rate: number
}

/** Strictly the picks that never came back for the follow-up at all. */
export type FollowupAbandonedRow = FollowupKey & {
  /** Picks with no answer row for `follow_node_id` — the respondent never returned. */
  abandoned: number
  /** `abandoned / picks`. */
  rate: number
}

export type Rollup = {
  form_id: string
  by: RollupGrain
  metric: RollupMetric
  window: {
    from: string | null
    to: string | null
    basis: 'response.completed_at'
    bounds: '[from, to)'
  }
  denominator: {
    completed_responses: number
    per_node: Record<string, number>
  }
  rows: RollupRow[]
  unresolved: RollupUnresolved & { per_node: Record<string, RollupUnresolved> }
  /** §5.4's coverage read-out, and the more useful of the two. */
  followup_unresolved: FollowupUnresolvedRow[]
  /** Only the never-came-back share. Not derivable from `followup_unresolved`. */
  followup_abandoned: FollowupAbandonedRow[]
  /**
   * The whole window's money, counted once per response rather than once per answered
   * node. `total_cents` can exceed the sum of `rows[].revenue_cents`: a response whose
   * channel answer is unresolved still paid, and has no row.
   */
  revenue: {
    total_cents: number
    paying_responses: number
    event: 'paid'
    currencies: string[]
    basis: 'first response per (form_id, external_id); all their paid events, regardless of occurred_at'
  }
  position_effect: null
  calibration: null
  notes: string[]
}

/** Carries the status the route should return, matching ResponseError in ./responses. */
export class RollupQueryError extends Error {
  status: number
  errors: string[]

  constructor(errors: string[]) {
    super('Invalid rollup query')
    this.name = 'RollupQueryError'
    this.status = 400
    this.errors = errors
  }
}

const MAX_ID = 128

// Same rule as the respondent write path (lib/attribution/responses.ts): Postgres refuses
// a NUL inside a text parameter at bind time, so `?form_id=%00` would come back as a 500
// carrying a raw driver error instead of the 404 an unknown id gets.
const UNSTORABLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\ud800-\udfff]/

const GRAINS = new Set<string>(['node', 'candidate'])
const METRICS = new Set<string>(['responses', 'revenue'])

/**
 * Read the query string. `form_id` is required and there is no union across forms.
 *
 * §7 states the reason and it is not ergonomics: candidate populations differ per form,
 * so a union would divide one form's selections by another form's respondents and
 * produce exactly the confident nonsense §6.2 spends its guards preventing. One
 * form-per-key was never an intended product constraint either — a customer runs one
 * form in signup and another at checkout (§3.7) — so "just use one key per form" is not
 * an answer.
 */
export function parseRollupQuery(url: URL): RollupQuery {
  const errors: string[] = []
  const formId = (url.searchParams.get('form_id') ?? '').trim()

  if (formId.length === 0) {
    errors.push('form_id is required; the rollup is never a union across forms (see §7)')
  } else if (formId.length > MAX_ID) {
    errors.push(`form_id must be at most ${MAX_ID} characters`)
  }

  const by = url.searchParams.get('by') ?? 'candidate'

  if (!GRAINS.has(by)) {
    errors.push('by must be "candidate" (one row per node × candidate) or "node"')
  }

  const metric = url.searchParams.get('metric') ?? 'responses'

  if (!METRICS.has(metric)) {
    errors.push('metric must be "responses" or "revenue"')
  }

  const from = readInstant(url.searchParams.get('from'), 'from', errors)
  const to = readInstant(url.searchParams.get('to'), 'to', errors)

  if (from && to && from >= to) {
    // The bounds are half-open, so from === to is an empty window rather than "one
    // instant". Rejecting it beats returning a well-formed payload full of zeroes that
    // reads as "this channel stopped working".
    errors.push('from must be strictly before to; the window is half-open, [from, to)')
  }

  if (errors.length > 0) {
    throw new RollupQueryError(errors)
  }

  return { formId, by: by as RollupGrain, metric: metric as RollupMetric, from, to }
}

type GroupedRow = {
  node_id: string
  /** Null only after {@link collapseToNodes}; the SQL never produces one. */
  candidate_id: string | null
  label: string | null
  label_from_node_id: string | null
  responses: number
  resolved_by_remap: number
  /** Null off the root node — the money lives on the response's channel row. */
  revenue_cents: number | null
  paying_responses: number | null
}

type UnresolvedRow = {
  node_id: string
  raw: number
  dont_remember: number
  skipped: number
}

type FollowupSqlRow = {
  node_id: string
  candidate_id: string
  follow_node_id: string
  picks: number
  unresolved_followups: number
  abandoned_followups: number
}

/**
 * Compute the rollup. Throws {@link FormNotFoundError} for both "no such form" and "not
 * your form" — see requireOwnedForm; telling those apart lets anyone walk the id space.
 */
export async function getRollup(accountId: string, query: RollupQuery): Promise<Rollup> {
  if (UNSTORABLE.test(query.formId)) {
    // An id that cannot be bound cannot name a form, and the caller learns nothing either
    // way. Same answer as an id that simply does not exist.
    throw new FormNotFoundError()
  }

  const form = await requireOwnedForm(accountId, query.formId)

  if (!form) {
    throw new FormNotFoundError()
  }

  const { formId, from, to } = query

  // One statement, returning one row of jsonb aggregates.
  //
  // Splitting this into four queries would mean four scans of the same windowed response
  // set, and — because they would not share a snapshot — a `remap` landing between them
  // could return rows whose shares do not sum against the denominator shipped beside
  // them. The jsonb wrapper is also what keeps the counts JSON numbers: bare COUNT(*) and
  // SUM(bigint) come back from the driver as strings (int8/numeric), which is a class of
  // bug that shows up as string concatenation in someone else's arithmetic later.
  const result = (await sql`
    WITH scoped AS (
      -- Decision 3: only completed responses, and the window filters completed_at — the
      -- moment attribution was recorded (decision 6). Matches
      -- idx_attribution_responses_cursor.
      SELECT r.id, r.config_version, r.external_id
      FROM attribution_responses r
      WHERE r.form_id = ${formId}
        AND r.completed_seq IS NOT NULL
        AND (${from}::timestamptz IS NULL OR r.completed_at >= ${from}::timestamptz)
        AND (${to}::timestamptz IS NULL OR r.completed_at < ${to}::timestamptz)
    ),

    -- §9: the first response per (form_id, external_id), and nothing else, may book
    -- revenue. Determined over the whole form rather than over the window on purpose: a
    -- retake inside the window would otherwise be "first" here and book the same money a
    -- January-windowed read already booked to the January answer.
    --
    -- (created_at, completed_seq) is the tiebreak, and it is copied from readIdentity in
    -- ./reads rather than chosen here. created_at can collide, and an arbitrary winner
    -- makes the number irreproducible between two identical calls — but the deeper reason
    -- is that ./reads flags one response per identity "canonical" and documents it as "the
    -- one the rollup books revenue against". This module used seq there, so on a
    -- created_at tie the two disagreed about which response was canonical and that
    -- docstring was false. One definition, in one place, or the claim cannot be made.
    -- Deliberately NOT windowed: a retake inside the window must not become "first" and
    -- book money the January-windowed read already booked to the January answer.
    --
    -- But narrowed to the identities the window actually contains. Unwindowed AND
    -- unnarrowed meant a DISTINCT ON sort over every response the form had ever collected
    -- on every rollup call — the unbounded read decision 1 forbids, growing without bound
    -- while the answer it contributes stays the same size.
    firsts AS (
      SELECT DISTINCT ON (r.external_id) r.id
      FROM attribution_responses r
      WHERE r.form_id = ${formId}
        AND r.completed_seq IS NOT NULL
        AND r.external_id IS NOT NULL
        AND r.external_id IN (
          SELECT external_id FROM scoped WHERE external_id IS NOT NULL
        )
      ORDER BY r.external_id, r.created_at, r.completed_seq
    ),

    -- Only 'paid'. value_cents is nullable on every event kind, so summing all of them
    -- would let a 'churned' or 'signup' row carrying a number quietly move revenue, and
    -- nobody reading "revenue_cents" would suspect it. Deliberately NOT windowed: a
    -- payment in March belongs to the channel recorded in January (decision 6).
    counted_events AS (
      SELECT e.external_id, e.value_cents, e.currency
      FROM attribution_events e
      JOIN scoped s ON s.external_id = e.external_id
      JOIN firsts fr ON fr.id = s.id
      WHERE e.form_id = ${formId}
        AND e.event = 'paid'
    ),

    paid AS (
      SELECT
        external_id,
        SUM(COALESCE(value_cents, 0))::bigint AS value_cents,
        COUNT(*)::int AS events
      FROM counted_events
      GROUP BY external_id
    ),

    -- Decision 2. The resolved candidate for an answer is the live remap's target if one
    -- exists, otherwise the answer's own candidate_id. raw_normalized is a generated
    -- column and is NULL for every kind but 'raw', so this join can only ever touch free
    -- text; the partial unique index on live remaps is what stops one string matching two
    -- rows and double-counting the response.
    answers AS (
      SELECT
        s.id AS response_id,
        s.external_id,
        s.config_version,
        a.node_id,
        a.kind,
        COALESCE(m.candidate_id, a.candidate_id) AS resolved_candidate_id,
        (m.candidate_id IS NOT NULL) AS via_remap,
        -- Decision 5: exactly one answer per response is the root one, so this is the flag
        -- that keeps revenue from being repeated per node. Read off the response's OWN
        -- config version rather than the form's current pointer: the root can be renamed
        -- between versions, and using today's root would book a response's money onto no
        -- row at all.
        (a.node_id = c.root_node_id) AS at_root
      FROM scoped s
      JOIN attribution_answers a ON a.response_id = s.id
      -- Primary key join, and the (form_id, config_version) FK on the response guarantees
      -- exactly one match, so this cannot change the row count of "scoped".
      JOIN attribution_configs c ON c.form_id = ${formId} AND c.version = s.config_version
      LEFT JOIN attribution_remaps m
        ON m.form_id = ${formId}
       AND m.node_id = a.node_id
       AND m.raw_normalized = a.raw_normalized
       AND m.revoked_at IS NULL
    ),

    -- Decision 5, the top-level total: once per response, over the first response per
    -- identity only. "firsts" is one row per external_id, so this join can return at most
    -- one row per identity and the sum cannot be inflated by a retake.
    revenue AS (
      SELECT
        COALESCE(SUM(p.value_cents), 0)::bigint AS total_cents,
        COUNT(*) FILTER (WHERE p.events > 0)::int AS paying_responses
      FROM scoped s
      JOIN firsts fr ON fr.id = s.id
      LEFT JOIN paid p ON p.external_id = s.external_id
    ),

    -- §4 and decision 6: the label a caller sees comes from the most recent snapshot that
    -- contains the id, never from the live catalog. A candidate dropped from the current
    -- config still has a label here, which is the point — history keeps its wording.
    --
    -- Narrowed to the ids the window actually produced, the way ./reads narrows its
    -- equivalent. Without the IN clause every version's entire candidate set is expanded
    -- on every call — 500 candidates per node (§5.1) times a version per month (§10.4),
    -- which grows without bound in the number of reconfigures rather than in the data.
    candidate_labels AS (
      SELECT
        c.version,
        node->>'id' AS node_id,
        cand->>'id' AS candidate_id,
        cand->>'label' AS label
      FROM attribution_configs c
      CROSS JOIN LATERAL jsonb_array_elements(c.nodes) AS node
      -- COALESCE because jsonb_array_elements aborts the whole statement on a non-array.
      -- The validator guarantees a candidates array on every node, so this only fires for
      -- a snapshot written by something other than configureForm, where losing a label
      -- beats failing the read.
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(node->'candidates', '[]'::jsonb)) AS cand
      WHERE c.form_id = ${formId}
        AND cand->>'id' IN (
          SELECT a.resolved_candidate_id FROM answers a WHERE a.resolved_candidate_id IS NOT NULL
        )
    ),

    labels AS (
      SELECT DISTINCT ON (node_id, candidate_id) node_id, candidate_id, label
      FROM candidate_labels
      ORDER BY node_id, candidate_id, version DESC
    ),

    -- The off-node fallback. A remap target is deliberately not a foreign key (§7), so an
    -- agent can resolve free text on "channel" to a candidate that only ever existed on
    -- "creator". ./remap's create path already reports that candidate's label and warns
    -- about the node mismatch; this is what stops the rollup from calling the same id
    -- unlabelled. node_id breaks the tie within a version so the choice is reproducible.
    labels_any_node AS (
      SELECT DISTINCT ON (candidate_id) candidate_id, label, node_id
      FROM candidate_labels
      ORDER BY candidate_id, version DESC, node_id
    ),

    -- Which picks carried a follow-up, per config version. Read out of the snapshot the
    -- response was rendered against rather than the current config: §10.4 has an agent
    -- retune which channels expand every month, so "did this pick open a second question"
    -- is a property of the version, and using today's answer would score respondents
    -- against a form they never saw.
    --
    -- Narrowed twice, for the reason spelled out on candidate_labels: to the versions the
    -- window contains (any other version's expansions can join nothing below) and to the
    -- candidate ids that were actually picked.
    expansions AS (
      SELECT
        c.version,
        node->>'id' AS node_id,
        cand->>'id' AS candidate_id,
        cand->>'expands' AS follow_node_id
      FROM attribution_configs c
      CROSS JOIN LATERAL jsonb_array_elements(c.nodes) AS node
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(node->'candidates', '[]'::jsonb)) AS cand
      WHERE c.form_id = ${formId}
        AND cand->>'expands' IS NOT NULL
        AND c.version IN (SELECT a.config_version FROM answers a)
        AND cand->>'id' IN (
          SELECT a.resolved_candidate_id
          FROM answers a
          WHERE a.kind = 'candidate' AND a.resolved_candidate_id IS NOT NULL
        )
    ),

    -- kind = 'candidate' only. A remapped free-text answer resolves to a candidate at
    -- READ time, but nothing expanded on the respondent's screen at the time, so it never
    -- had a follow-up to abandon and must stay out of this denominator.
    expanded_picks AS (
      SELECT a.response_id, a.node_id, a.resolved_candidate_id AS candidate_id, x.follow_node_id
      FROM answers a
      JOIN expansions x
        ON x.version = a.config_version
       AND x.node_id = a.node_id
       AND x.candidate_id = a.resolved_candidate_id
      WHERE a.kind = 'candidate'
    ),

    per_node AS (
      SELECT a.node_id, COUNT(*)::int AS answered
      FROM answers a
      GROUP BY a.node_id
    ),

    grouped AS (
      SELECT
        a.node_id,
        a.resolved_candidate_id AS candidate_id,
        COALESCE(l.label, la.label) AS label,
        -- Null when the label came from this node, which is the ordinary case. Non-null
        -- names the node it had to be borrowed from, so a caller is never told "Jade"
        -- without being told the id is not a candidate of the node it is being reported on.
        CASE WHEN l.candidate_id IS NULL THEN la.node_id END AS label_from_node_id,
        COUNT(*)::int AS responses,
        COUNT(*) FILTER (WHERE a.via_remap)::int AS resolved_by_remap,
        -- Decision 5. Only the root node's rows carry money, and off the root the value is
        -- NULL rather than 0 — the response's revenue is real, it is just booked one row
        -- over. bool_or, because at_root is a property of (node_id, version) and a form
        -- whose root node was renamed can put both kinds of answer in one group; the number
        -- then covers the root portion, which is the only portion that has one.
        --
        -- fr.id IS NOT NULL is not redundant with counted_events' own filter: paid is
        -- keyed by external_id, so without it a retake sharing that id would attach the
        -- same money to whatever channel the retake named.
        CASE WHEN bool_or(a.at_root) THEN
          COALESCE(
            SUM(CASE WHEN a.at_root AND fr.id IS NOT NULL THEN p.value_cents ELSE 0 END),
            0
          )::bigint
        END AS revenue_cents,
        CASE WHEN bool_or(a.at_root) THEN
          COUNT(*) FILTER (WHERE a.at_root AND fr.id IS NOT NULL AND p.events > 0)::int
        END AS paying_responses
      FROM answers a
      LEFT JOIN firsts fr ON fr.id = a.response_id
      LEFT JOIN paid p ON p.external_id = a.external_id
      LEFT JOIN labels l
        ON l.node_id = a.node_id AND l.candidate_id = a.resolved_candidate_id
      LEFT JOIN labels_any_node la ON la.candidate_id = a.resolved_candidate_id
      WHERE a.resolved_candidate_id IS NOT NULL
      GROUP BY a.node_id, a.resolved_candidate_id, l.candidate_id, l.label, la.label, la.node_id
    ),

    -- Decision 4's remainder, itemized. raw here is free text with NO live remap: text
    -- a remap has since resolved is a resolved row above, which is what makes a mapping
    -- visibly move a number rather than silently.
    unresolved AS (
      SELECT
        a.node_id,
        COUNT(*) FILTER (WHERE a.kind = 'raw' AND a.resolved_candidate_id IS NULL)::int AS raw,
        COUNT(*) FILTER (WHERE a.kind = 'dont_remember')::int AS dont_remember,
        COUNT(*) FILTER (WHERE a.kind = 'skipped')::int AS skipped
      FROM answers a
      GROUP BY a.node_id
    ),

    -- Decision 7's two numbers, from one scan, because they share a denominator and
    -- nothing else. COVERAGE (unresolved_followups) is §5.4's read-out: a follow-up counts
    -- as resolved only when it resolves to a candidate id, so dont_remember, skipped and
    -- unmapped free text are all misses. ABANDONMENT is the missing answer row alone —
    -- a swept response has no row for the node it was waiting on, so fa.response_id IS
    -- NULL is exactly "never came back", and it is a strict subset of the first.
    --
    -- Abandonment is measured per PICK, not per response: a response that answered this
    -- follow-up and then abandoned a deeper one came back for this pick, and is the
    -- abandoner of the later pick's row instead.
    followup AS (
      SELECT
        p.node_id,
        p.candidate_id,
        p.follow_node_id,
        COUNT(*)::int AS picks,
        COUNT(*) FILTER (WHERE fa.resolved_candidate_id IS NULL)::int AS unresolved_followups,
        COUNT(*) FILTER (WHERE fa.response_id IS NULL)::int AS abandoned_followups
      FROM expanded_picks p
      LEFT JOIN answers fa
        ON fa.response_id = p.response_id AND fa.node_id = p.follow_node_id
      GROUP BY p.node_id, p.candidate_id, p.follow_node_id
    )

    SELECT
      (SELECT COUNT(*)::int FROM scoped) AS completed_responses,
      COALESCE(
        (SELECT jsonb_object_agg(node_id, answered) FROM per_node),
        '{}'::jsonb
      ) AS per_node,
      COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM grouped g), '[]'::jsonb) AS grouped,
      COALESCE((SELECT jsonb_agg(to_jsonb(u)) FROM unresolved u), '[]'::jsonb) AS unresolved,
      COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM followup f), '[]'::jsonb) AS followup,
      -- Wrapped in jsonb like every other aggregate here: total_cents is a bigint, and the
      -- driver hands a bare int8 back as a string.
      (SELECT to_jsonb(rv) FROM revenue rv) AS revenue,
      COALESCE(
        -- NOT lower(): readCurrency stores ISO 4217 upper-cased, so lowering here made
        -- the value read back a different string from the one written, and any caller
        -- comparing against 'USD' silently matched nothing.
        (SELECT jsonb_agg(DISTINCT currency) FROM counted_events WHERE currency IS NOT NULL),
        '[]'::jsonb
      ) AS currencies
  `) as Array<{
    completed_responses: number
    per_node: unknown
    grouped: unknown
    unresolved: unknown
    followup: unknown
    revenue: unknown
    currencies: unknown
  }>

  const row = result[0]
  const perNode = parseJsonValue<Record<string, number>>(row.per_node) ?? {}
  const grouped = parseJsonValue<GroupedRow[]>(row.grouped) ?? []
  const unresolvedRows = parseJsonValue<UnresolvedRow[]>(row.unresolved) ?? []
  const followupRows = parseJsonValue<FollowupSqlRow[]>(row.followup) ?? []
  const currencies = parseJsonValue<string[]>(row.currencies) ?? []
  const revenue = parseJsonValue<{ total_cents: number; paying_responses: number }>(
    row.revenue,
  ) ?? { total_cents: 0, paying_responses: 0 }

  // A Map rather than indexing perNode directly. Node ids are caller-defined (§5.1), so a
  // node called `toString` or `constructor` resolves through the prototype of the object
  // JSON.parse handed back and puts a FUNCTION where a denominator belongs — which `??`
  // passes straight through into the division. Same hazard positionsOf guards in ./order.
  const denominators = new Map(Object.entries(perNode))

  const rows = (query.by === 'node' ? collapseToNodes(grouped) : grouped).map((entry) => ({
    node_id: entry.node_id,
    candidate_id: entry.candidate_id,
    label: entry.label,
    label_from_node_id: entry.label_from_node_id,
    responses: entry.responses,
    share: ratio(entry.responses, denominators.get(entry.node_id) ?? 0),
    share_corrected: null as null,
    revenue_cents: entry.revenue_cents,
    paying_responses: entry.paying_responses,
    resolved_by_remap: entry.resolved_by_remap,
  }))

  sortRows(rows, query.metric)

  return {
    form_id: formId,
    by: query.by,
    metric: query.metric,
    window: { from, to, basis: 'response.completed_at', bounds: '[from, to)' },
    denominator: { completed_responses: row.completed_responses, per_node: perNode },
    rows,
    unresolved: {
      ...totalUnresolved(unresolvedRows),
      per_node: Object.fromEntries(
        unresolvedRows.map((entry) => [
          entry.node_id,
          { raw: entry.raw, dont_remember: entry.dont_remember, skipped: entry.skipped },
        ]),
      ),
    },
    followup_unresolved: sortFollowups(
      followupRows.map((entry) => ({
        node_id: entry.node_id,
        candidate_id: entry.candidate_id,
        follow_node_id: entry.follow_node_id,
        picks: entry.picks,
        unresolved: entry.unresolved_followups,
        rate: ratio(entry.unresolved_followups, entry.picks),
      })),
      (entry) => entry.unresolved,
    ),
    followup_abandoned: sortFollowups(
      followupRows.map((entry) => ({
        node_id: entry.node_id,
        candidate_id: entry.candidate_id,
        follow_node_id: entry.follow_node_id,
        picks: entry.picks,
        abandoned: entry.abandoned_followups,
        rate: ratio(entry.abandoned_followups, entry.picks),
      })),
      (entry) => entry.abandoned,
    ),
    revenue: {
      total_cents: revenue.total_cents,
      paying_responses: revenue.paying_responses,
      event: 'paid',
      currencies,
      basis:
        'first response per (form_id, external_id); all their paid events, regardless of occurred_at',
    },
    position_effect: null,
    calibration: null,
    notes: notesFor(query, currencies),
  }
}

/**
 * Collapse the candidate grain to one row per node.
 *
 * Summing here rather than in a second GROUP BY variant is safe for an exact reason
 * worth stating: attribution_answers is keyed (response_id, node_id), so within a node
 * the candidate buckets are disjoint sets of responses. `paying_responses` and
 * `revenue_cents` therefore add without double counting — which would NOT hold if a
 * response could answer one node twice, and is also why decision 5 confines revenue to
 * one node: the same guarantee does not hold ACROSS nodes, where a response appears once
 * per question it answered.
 *
 * It also stays inside decision 1. The scan and the aggregation happened in SQL; what is
 * left is at most one row per (node, candidate) already in memory.
 */
function collapseToNodes(grouped: GroupedRow[]): GroupedRow[] {
  const byNode = new Map<string, GroupedRow>()

  for (const entry of grouped) {
    const current = byNode.get(entry.node_id)

    if (!current) {
      // candidate_id and both label fields are emptied rather than carried: keeping the
      // first candidate's would label a whole-node total with one creator's name.
      byNode.set(entry.node_id, {
        ...entry,
        candidate_id: null,
        label: null,
        label_from_node_id: null,
      })
      continue
    }

    current.responses += entry.responses
    current.resolved_by_remap += entry.resolved_by_remap
    current.revenue_cents = addNullable(current.revenue_cents, entry.revenue_cents)
    current.paying_responses = addNullable(current.paying_responses, entry.paying_responses)
  }

  return [...byNode.values()]
}

/**
 * Adds two revenue figures where null means "not reported at this grain" (decision 5).
 *
 * Null only survives when BOTH sides are null, because collapsing a node whose rows are
 * all off-root must not invent a 0 — the very reading the null exists to prevent.
 */
function addNullable(left: number | null, right: number | null): number | null {
  if (left === null) {
    return right
  }

  if (right === null) {
    return left
  }

  return left + right
}

/**
 * Deterministic order for the follow-up arrays: biggest numerator first, then the key.
 *
 * Sorted here rather than in SQL because jsonb_agg makes no ordering promise without an
 * explicit ORDER BY inside it, and an array whose order changes between two identical
 * calls reads as movement to a caller diffing month over month — the same reason sortRows
 * has a tiebreak.
 */
function sortFollowups<T extends FollowupKey>(rows: T[], numerator: (row: T) => number): T[] {
  return rows.sort(
    (a, b) =>
      numerator(b) - numerator(a) ||
      b.picks - a.picks ||
      a.node_id.localeCompare(b.node_id) ||
      a.candidate_id.localeCompare(b.candidate_id) ||
      a.follow_node_id.localeCompare(b.follow_node_id),
  )
}

/**
 * `metric` chooses the sort, not which columns ship.
 *
 * Both columns ship on every row that has them, because they only mean something
 * together: heads without revenue cannot tell a cheap channel from a valuable one, and
 * revenue without heads hides that a channel's whole total came from a single customer.
 * Dropping one would also force a second round trip to get a number the same scan already
 * produced. `metric=revenue` on a form whose money all sits on the root node therefore
 * sorts the root's candidates and leaves the follow-up rows behind them (decision 5).
 */
function sortRows(rows: RollupRow[], metric: RollupMetric) {
  rows.sort((a, b) => {
    // A null revenue sorts as -1 rather than 0, so the rows that carry no revenue figure
    // at all (decision 5: anything off the root node) land behind a root row that genuinely
    // earned nothing. Sorting them together would suggest the two mean the same thing.
    const primary =
      metric === 'revenue'
        ? (b.revenue_cents ?? -1) - (a.revenue_cents ?? -1)
        : b.responses - a.responses

    if (primary !== 0) {
      return primary
    }

    // Deterministic tiebreak. Without it two identical calls can return the same rows in
    // different orders, and a caller diffing month over month reads that as movement.
    return (
      a.node_id.localeCompare(b.node_id) ||
      (a.candidate_id ?? '').localeCompare(b.candidate_id ?? '')
    )
  })
}

function totalUnresolved(rows: UnresolvedRow[]): RollupUnresolved {
  return rows.reduce<RollupUnresolved>(
    (total, entry) => ({
      raw: total.raw + entry.raw,
      dont_remember: total.dont_remember + entry.dont_remember,
      skipped: total.skipped + entry.skipped,
    }),
    { raw: 0, dont_remember: 0, skipped: 0 },
  )
}

/**
 * Six decimal places, and the integer counts ship beside it.
 *
 * Rounding at all is a readability concession; rounding to two would make a long tail of
 * genuinely-different candidates all read as 0.00, and §3.3 says the most valuable
 * output of attribution is the channel nobody expected — which is exactly the row that
 * lives in that tail.
 */
function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0
  }

  return Math.round((numerator / denominator) * 1e6) / 1e6
}

/**
 * Every note here exists because a reader would otherwise infer something wrong from a
 * number that looks unambiguous. §7: "every number that can be wrong ships next to the
 * thing that says how wrong it might be."
 */
function notesFor(query: RollupQuery, currencies: string[]): string[] {
  const notes = [
    'share_corrected is not computed in v1 — see design doc §6.2. Under the default rotate order the raw share is already unbiased by construction (§6.1), and the estimator needs volume to return anything but null, so it would only serve fixed-mode callers.',
    'position_effect and calibration are not computed in v1 either; they are returned as explicit nulls so their absence is visible.',
    'share = responses / denominator.per_node[node_id], where that denominator is every completed response that ANSWERED that node. Resolved shares therefore sum to less than 1, and the remainder is the unresolved block for the same node.',
    'A response that picked a channel and never answered the follow-up is counted for the channel node and is absent from the follow-up node entirely. It appears in followup_abandoned, not in that node\'s denominator.',
    'followup_unresolved and followup_abandoned share a denominator (picks that opened a follow-up) and count different things, so neither is derivable from the other. followup_unresolved is the candidate-coverage read-out (§5.4): a follow-up counts as resolved only when it resolves to a candidate id, so never-returned, dont_remember, skipped and free text with no live remap are all unresolved — and free text a remap HAS resolved counts as resolved, so a mapping visibly moves the number. followup_abandoned counts ONLY the picks with no answer row for the follow-up node, i.e. the respondents who never came back.',
    'Both follow-up arrays are keyed by explicit node_id / candidate_id / follow_node_id fields rather than a joined string, because both ids are caller-defined (§5.1) and any separator is a character a caller may already be using inside an id.',
    'revenue.total_cents and revenue.paying_responses are the window\'s totals, counted once per response. Per-row revenue_cents and paying_responses are reported ONLY on rows of the root node and are null elsewhere: a response\'s money belongs to the response, so repeating it on every node it answered would multiply the total by the number of questions answered. Null rather than 0, because 0 would read as "this candidate produced no revenue".',
    'revenue.total_cents can exceed the sum of rows[].revenue_cents. A response whose channel answer is unresolved (dont_remember, skipped, or free text with no live remap) still books its money, and has no row to book it on.',
    'Revenue counts only the FIRST response per (form_id, external_id) (§9). A retake still counts in `responses` and books no revenue, so revenue-weighted and head-weighted shares can disagree.',
    'The window filters response.completed_at only. Revenue for the responses in it is summed over ALL their paid events whatever the event date: a payment in March belongs to the channel recorded in January.',
    'Labels come from the most recent config version containing that candidate id, never the live catalog (§4). A remap target that exists only on another node of this form is labelled from that node, and label_from_node_id names it. label is null only when no version of this form contains the id at all.',
    'Bounds are half-open, [from, to). A value carrying no timezone — "2026-07-01" or "2026-07-01T00:00:00" — is read as UTC, not as the server\'s local time.',
  ]

  if (query.by === 'node') {
    notes.push(
      'by=node rolls every resolved candidate in a node into one row; candidate_id and label are null. Use by=candidate for the per-candidate breakdown.',
    )
  }

  if (currencies.length > 1) {
    notes.push(
      `revenue_cents sums ${currencies.length} currencies (${currencies.join(', ')}) as if they were one. Filter your events to a single currency, or treat these totals as unusable.`,
    )
  }

  return notes
}
