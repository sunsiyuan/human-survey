import { randomBytes, timingSafeEqual } from 'node:crypto'

import { nanoid } from 'nanoid'

import { hashSecret } from '@/lib/auth'
import { parseJsonValue, sql, tx } from '@/lib/db'
import { sanitizeMetadata } from '@/lib/metadata'

import { orderCandidates, positionsOf } from './order'
import type { AskNode, Candidate } from './schema'

/**
 * The respondent write path: POST the first selection, PATCH the follow-up.
 *
 * Design contract: docs/design/attribution-pivot.md §5.4. Progressive submission buys
 * the benefit of pagination — the first answer is durable the moment it is made —
 * without paying its cost, because nothing about it reads as a page transition.
 *
 * Five things in here are load-bearing and look like bookkeeping:
 *
 * 1. A response that needs no follow-up is INSERTed open and then UPDATEd complete
 *    inside one transaction. `completed_seq` is stamped by a BEFORE UPDATE trigger
 *    (001_init.sql, stamp_response_completion), so a row inserted already-complete
 *    carries a null cursor token and is never delivered to any consumer at all.
 * 2. PATCH's write is one guarded statement rather than a read-then-write. Two
 *    concurrent PATCHes holding the same token would otherwise both pass the
 *    `completed_at` check, and the loser would die on the answers primary key — a 500
 *    for what is a 409.
 * 3. `raw` is never trimmed here. §7's retroactive remap keys off `raw_normalized`, a
 *    generated column in the database; normalizing on the way in would be a second,
 *    competing definition of the same thing, and only one of them can be changed by an
 *    ALTER later.
 * 4. Answers are validated against the config version the response was RENDERED
 *    against, never the form's current one — on POST it comes from the body (§5.3), on
 *    PATCH from the stored row. A reconfigure is a monthly event (§10.4), and one that
 *    lands between page load and submit would otherwise validate the answer against a
 *    snapshot the respondent never saw: a dropped candidate reads as an unknown id, and
 *    the recorded positions describe a list that was never rendered.
 * 5. NOTHING about rendered position is read from the request body. The client sends
 *    `render_id` and `selected_via_search`; the impressions map and the answer's own
 *    index are both derived here from (render_id, config_version, node) via
 *    positionsOf(orderCandidates(...)) — see `renderOf`. The permutation is pure and
 *    deterministic, so this recomputation is not a check against a submitted map, it IS
 *    the map. The earlier design took the map from the body and verified it, which cost
 *    four defects in one review round: the two computations disagreed about pinned rows
 *    and 400'd every genuine submission, the selection index stayed forgeable while the
 *    denominator was verified, and `position: null` was indistinguishable from absent.
 *    Deriving it removes the second source rather than aligning the two.
 */

export type SubmitContext = {
  /** `Origin` header of the request. */
  origin: string | null
  /**
   * Origin this request was served from, i.e. ours. Needed to tell a standalone visit to
   * /s/{id} (no host page, so same-origin with us) apart from an embed, which is also
   * same-origin at the header level but declares its host page in the body.
   */
  selfOrigin: string | null
}

export type SubmitResult = {
  response_id: string
  patch_token: string
  next_node?: AskNode
}

export type PatchResult = {
  response_id: string
  completed: boolean
  next_node?: AskNode
}

/**
 * Carries the HTTP status the route should return, so that every failure this module
 * can produce has one definition rather than being re-derived from a message string at
 * the boundary. `errors` is populated for payload validation, where returning one
 * problem per round trip means a caller burns a turn per typo (same reasoning as
 * AttributionConfigError in ./schema).
 */
export class ResponseError extends Error {
  status: number
  errors?: string[]

  constructor(status: number, message: string, errors?: string[]) {
    super(message)
    this.name = 'ResponseError'
    this.status = status
    this.errors = errors
  }
}

const MAX_ID = 128
const MAX_RENDER_ID = 64
const MAX_EXTERNAL_ID = 256
const MAX_TOKEN = 256

// A DNS name tops out at 253 characters, so anything longer is not an origin. Applied
// before the string reaches `new URL`, which parses arbitrarily long garbage happily.
const MAX_ORIGIN = 256

const MAX_INT4 = 2_147_483_647

// Postgres refuses a NUL inside a text parameter at bind time, so one pasted into any
// field on this public endpoint becomes a 500 carrying a raw driver error rather than a
// validation failure. The rest of the C0 set and DEL ride along on the same rule: none
// of them belongs in an id, a handle or a name, and they survive round trips invisibly.
// Tab, newline and carriage return are allowed — free text is pasted from real pages.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

// A UTF-16 code unit from either surrogate half without its partner. Reachable from any
// JSON body — "\ud800" is valid JSON and parses to a lone surrogate — and it survives
// neither of the two bindings this module writes through:
//
//   metadata is bound as ::jsonb, and JSON.stringify is well-formed (ES2019), so the
//   parameter carries a literal \ud800 escape, which jsonb input rejects outright:
//   SQLSTATE 22P05, i.e. a 500 with a raw driver message on a public endpoint.
//
//   text parameters do not error — Node substitutes U+FFFD when encoding to UTF-8 — but
//   that silently rewrites the value. On `raw` it rewrites §7's remap key, so the text
//   the respondent typed is not the text a later remap matches on; on `render_id` it
//   rewrites the permutation seed, so the map POST derives and the map PATCH derives
//   from the stored id describe two different renders.
//
// CONTROL_CHARACTERS catches neither: a surrogate is nowhere near the C0 range.
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/

// Long enough for "the one who does the office skits", short enough that a public,
// unauthenticated endpoint cannot be used to store documents. Over-length free text is
// REJECTED rather than truncated: `raw` is the remap key (§7), and a silently clipped
// key resolves to a different bucket than the one the respondent typed.
const MAX_RAW = 500

// Each swept row fires the completion trigger, which takes and holds a row lock on the
// owning form until commit — that lock is what makes commit order match completed_seq
// order. So an unbounded sweep blocks every live respondent's completion on that form
// for as long as it runs. Sweeping in batches keeps that window short.
const SWEEP_BATCH = 500
const MAX_SWEEP_BATCH = 5000

type FormForWrite = {
  status: string
  allowed_origins: string[]
  config_version: number
  root_node_id: string
  nodes: Map<string, AskNode>
}

type ParsedAnswer = {
  kind: 'candidate' | 'raw' | 'dont_remember' | 'skipped'
  candidateId: string | null
  raw: string | null
  candidate: Candidate | null
}

/**
 * First selection. Creates the response, records the answer, and either hands back the
 * follow-up node or closes the response out on the spot.
 */
export async function submitResponse(
  routeFormId: string,
  body: unknown,
  context: SubmitContext,
): Promise<SubmitResult> {
  const formId = readRouteFormId(routeFormId)

  // Same answer as an id that simply does not exist. A form id that cannot be stored
  // cannot name a form, and the caller learns nothing either way.
  if (formId === null) {
    throw new ResponseError(404, 'Form not found')
  }

  if (!isRecord(body)) {
    throw new ResponseError(400, 'Request body must be an object')
  }

  // Read before the form, because it decides WHICH snapshot the rest of this function
  // validates against (§5.3). Falling back to the form's current version is only right
  // for a client that predates the field; a client that sends it was rendered against it.
  const versionErrors: string[] = []
  const requestedVersion = readVersion(body.config_version, versionErrors)

  if (versionErrors.length > 0) {
    throw new ResponseError(400, 'Invalid response payload', versionErrors)
  }

  const form = await loadForm(formId, requestedVersion)

  if (form.status !== 'active') {
    // 409 and not 410: pausing is reversible (§2 collapsed the lifecycle to
    // active/paused), and 410 tells a client the resource is gone for good.
    throw new ResponseError(409, 'This form is not accepting responses')
  }

  assertOriginAllowed(body.host_origin, context.origin, context.selfOrigin, form.allowed_origins)

  const errors: string[] = []
  const renderId = readString(body.render_id, 'render_id', errors, {
    required: true,
    max: MAX_RENDER_ID,
  })
  const nodeId = readString(body.node_id, 'node_id', errors, { required: true, max: MAX_ID })

  // Respondent-controlled and never verified: anyone who knows a host's user-id format
  // can bind a forged channel answer to somebody else's identity. Signing it is the real
  // fix and is deliberately not built yet, so the honest statement is that this is a join
  // key (§9), not an authentication of who answered.
  //
  // One mitigation is already load-bearing: §9's rollup counts the FIRST response per
  // (form_id, external_id), so a forgery has to beat the real user to the form rather
  // than overwrite them after the fact. Treated as an opaque string — capped, and
  // otherwise stored exactly as the host writes its own ids.
  const externalId = readString(body.external_id, 'external_id', errors, { max: MAX_EXTERNAL_ID })
  const selectedViaSearch = readFlag(body.selected_via_search, 'selected_via_search', errors)

  const node = nodeId === null ? undefined : form.nodes.get(nodeId)

  if (nodeId !== null && !node) {
    errors.push(`node_id "${nodeId}" is not a node of this form`)
  }

  // POST is the first selection by definition (§5.4). Accepting any node here would let
  // a respondent create a response carrying no channel answer at all — the one field
  // this product exists to collect — and then sit awaiting a node it never reached.
  if (node && node.id !== form.root_node_id) {
    errors.push(`node_id must be the root node "${form.root_node_id}"`)
  }

  const answer = node ? readAnswer(body.answer, node, errors) : null

  // `body.positions` and `body.position` are read by nothing, on purpose, and are also
  // not rejected: a client built against the previous contract still sends both, and a
  // release that 400s them would break every embed that has not redeployed yet on a
  // change whose entire point is that no genuine submission can be rejected. Grace
  // period — the tolerance can go once the shipped clients have turned over.

  // Host-supplied response tags. Sanitized because anyone can reach this endpoint.
  const metadata = sanitizeMetadata(body.metadata)

  assertMetadataStorable(metadata, errors)

  if (errors.length > 0 || !node || !answer || !renderId || !nodeId) {
    throw new ResponseError(400, 'Invalid response payload', errors)
  }

  const rendered = renderOf(node, renderId)
  const nextNode = resolveExpansion(answer.candidate, form.nodes)
  const responseId = nanoid(12)

  // Handed to the browser once and never again. Without it, a public PATCH keyed on an
  // id this endpoint returns to that same browser lets anyone holding an id overwrite
  // someone else's answer (§5.4). Stored hashed, like every other secret in the schema.
  const patchToken = randomBytes(24).toString('base64url')

  const statements = [
    sql`
      INSERT INTO attribution_responses (
        id, form_id, config_version, render_id, patch_token_hash,
        awaiting_node_id, external_id, positions, metadata
      ) VALUES (
        ${responseId}, ${formId}, ${form.config_version}, ${renderId}, ${hashSecret(patchToken)},
        ${nextNode?.id ?? null}, ${externalId},
        ${JSON.stringify({ [node.id]: rendered })}::jsonb,
        ${JSON.stringify(metadata)}::jsonb
      )
    `,
    sql`
      INSERT INTO attribution_answers (
        response_id, node_id, kind, candidate_id, raw, selected_via_search, position
      ) VALUES (
        ${responseId}, ${nodeId}, ${answer.kind}, ${answer.candidateId}, ${answer.raw},
        ${selectedViaSearch}, ${selectedIndex(rendered, answer, selectedViaSearch)}
      )
    `,
  ]

  if (!nextNode) {
    // Insert-then-update, in one transaction, for a response that is already finished.
    // stamp_response_completion is a BEFORE UPDATE trigger: inserting a row with
    // completed_at already set leaves completed_seq null, which is the cursor token, so
    // the response is durable and permanently invisible to every reader (§5.4).
    statements.push(sql`
      UPDATE attribution_responses
      SET completed_at = now(), completion = 'finished'
      WHERE id = ${responseId}
    `)
  }

  await tx(statements)

  return nextNode
    ? { response_id: responseId, patch_token: patchToken, next_node: nextNode }
    : { response_id: responseId, patch_token: patchToken }
}

/**
 * The follow-up. Requires the token minted by `submitResponse`.
 *
 * The token is good until the response completes rather than for exactly one call: a
 * deeper expansion chain needs it a second time, and rotating it per call would buy
 * nothing when the holder is the same browser either way.
 *
 * Deliberately not gated on the form's origin allowlist or on its status. Both gates
 * decide whether a response should be CREATED (§10.3 — an unlisted origin spends the
 * owner's quota). This one already exists and already counts whether or not it
 * completes, so re-checking here would buy nothing and would convert a real answer into
 * an abandonment every time an origin list or a pause landed mid-response.
 */
export async function patchResponse(routeFormId: string, body: unknown): Promise<PatchResult> {
  const formId = readRouteFormId(routeFormId)

  // The same 403 an unknown response id gets, for the same reason: an id that cannot be
  // stored matches no response, and a distinct status here would answer "is this form
  // id well-formed" for a caller who has proved nothing.
  if (formId === null) {
    throw new ResponseError(403, 'Unknown response id or patch token')
  }

  if (!isRecord(body)) {
    throw new ResponseError(400, 'Request body must be an object')
  }

  const identityErrors: string[] = []
  const responseId = readString(body.response_id, 'response_id', identityErrors, {
    required: true,
    max: MAX_ID,
  })
  const patchToken = readString(body.patch_token, 'patch_token', identityErrors, {
    required: true,
    max: MAX_TOKEN,
  })
  const nodeId = readString(body.node_id, 'node_id', identityErrors, {
    required: true,
    max: MAX_ID,
  })

  if (!responseId || !patchToken || !nodeId) {
    throw new ResponseError(400, 'Invalid response payload', identityErrors)
  }

  const rows = (await sql`
    SELECT r.patch_token_hash, r.awaiting_node_id, r.completed_at, r.render_id, c.nodes
    FROM attribution_responses r
    JOIN attribution_configs c
      ON c.form_id = r.form_id AND c.version = r.config_version
    WHERE r.id = ${responseId} AND r.form_id = ${formId}
    LIMIT 1
  `) as Array<{
    patch_token_hash: string
    awaiting_node_id: string | null
    completed_at: string | null
    render_id: string
    nodes: unknown
  }>

  const row = rows[0]

  // One answer for "no such response" and for "wrong token", because the caller is
  // anonymous and the two apart are an existence oracle: response ids are 12 nanoid
  // characters handed straight back to a browser, and distinguishing the cases turns
  // guessing one into a yes/no question this endpoint answers for free.
  //
  // Checked before any state, so a caller who cannot prove the response is theirs learns
  // nothing about it — not whether it is complete, not which node it awaits.
  if (!row || !tokenMatches(patchToken, row.patch_token_hash)) {
    throw new ResponseError(403, 'Unknown response id or patch token')
  }

  if (row.completed_at !== null) {
    throw new ResponseError(409, 'This response is already complete')
  }

  const nodes = indexNodes(parseJsonValue<AskNode[]>(row.nodes))
  const node = row.awaiting_node_id ? nodes.get(row.awaiting_node_id) : undefined

  if (!node || node.id !== nodeId) {
    throw new ResponseError(
      409,
      row.awaiting_node_id
        ? `This response is awaiting node "${row.awaiting_node_id}"`
        : 'This response is not awaiting a follow-up',
    )
  }

  const errors: string[] = []
  const selectedViaSearch = readFlag(body.selected_via_search, 'selected_via_search', errors)
  const answer = readAnswer(body.answer, node, errors)

  if (errors.length > 0 || !answer) {
    throw new ResponseError(400, 'Invalid response payload', errors)
  }

  // The render id comes off the stored row, never the body. It was fixed when the
  // response was created, and taking it from a later request would let the caller choose
  // the seed — and therefore the permutation their pick is scored against — after
  // already seeing the list. A body `positions`/`position` is ignored here too (same
  // grace period as POST).
  const rendered = renderOf(node, row.render_id)

  // Expansion chains deeper than two levels are rare but the validator permits them
  // (./schema checks for cycles and unreachable nodes, which only matter beyond depth
  // two). Completing unconditionally here would silently discard the third answer.
  const nextNode = resolveExpansion(answer.candidate, nodes)

  // One statement, because the guard and the write have to be indivisible. The UPDATE's
  // WHERE clause is the lock: a concurrent PATCH with the same token blocks on the row,
  // re-evaluates against the committed version, matches nothing, and the answer INSERT
  // — fed from the UPDATE's RETURNING — never runs.
  //
  // `positions` is merged rather than replaced, and the derived map is keyed by the one
  // node being answered, so a PATCH cannot rewrite what the first render recorded for the
  // root — there is no body field that could name another node in the first place.
  const written = (await sql`
    WITH claimed AS (
      UPDATE attribution_responses
      SET awaiting_node_id = ${nextNode?.id ?? null},
          completed_at = CASE WHEN ${nextNode?.id ?? null}::text IS NULL THEN now() END,
          completion   = CASE WHEN ${nextNode?.id ?? null}::text IS NULL THEN 'finished' END,
          positions    = positions || ${JSON.stringify({ [node.id]: rendered })}::jsonb
      WHERE id = ${responseId}
        AND form_id = ${formId}
        AND completed_at IS NULL
        AND awaiting_node_id = ${nodeId}
      RETURNING id
    ),
    recorded AS (
      INSERT INTO attribution_answers (
        response_id, node_id, kind, candidate_id, raw, selected_via_search, position
      )
      SELECT
        claimed.id,
        ${nodeId}::text,
        ${answer.kind}::text,
        ${answer.candidateId}::text,
        ${answer.raw}::text,
        ${selectedViaSearch}::boolean,
        ${selectedIndex(rendered, answer, selectedViaSearch)}::int
      FROM claimed
      RETURNING response_id
    )
    SELECT response_id FROM recorded
  `) as Array<{ response_id: string }>

  if (written.length === 0) {
    // Lost the race to a concurrent PATCH or to the abandonment sweep. Nothing was
    // written, because the INSERT reads from the UPDATE that matched no row.
    throw new ResponseError(409, 'This response is already complete')
  }

  return nextNode
    ? { response_id: responseId, completed: false, next_node: nextNode }
    : { response_id: responseId, completed: true }
}

/**
 * Close responses that picked a channel and never came back for the follow-up.
 *
 * This is what releases a half-finished response into the cursor stream (§5.4). Until
 * it runs, such a response has no `completed_seq` and is therefore delivered to nobody
 * — a person who abandons the second question would otherwise be worse than lost, since
 * their channel answer is real data the product already collected.
 *
 * The completion trigger bills a swept row exactly like a finished one, which is
 * §10.3's stated rule: the channel is known, so the response counts.
 *
 * `awaiting_node_id IS NOT NULL` is the whole population of open rows — `submitResponse`
 * either completes a response or leaves it awaiting a node, never neither — and matches
 * idx_attribution_responses_awaiting exactly.
 *
 * Deliberately not wired to a schedule. The threshold is still open (§13) and wants to
 * come from real data, so the caller supplies it.
 */
export async function sweepAbandoned(
  formId: string,
  olderThanMinutes: number,
  batchLimit: number = SWEEP_BATCH,
): Promise<number> {
  if (!Number.isFinite(olderThanMinutes) || olderThanMinutes < 0) {
    throw new ResponseError(400, 'older_than_minutes must be a non-negative number')
  }

  const minutes = Math.trunc(olderThanMinutes)
  const batch = Math.min(Math.max(1, Math.trunc(batchLimit) || 1), MAX_SWEEP_BATCH)

  // SKIP LOCKED matters in both directions: the sweep never waits on a respondent who
  // is completing right now, and never turns that respondent's answer into an
  // abandonment behind their back.
  const rows = (await sql`
    WITH due AS (
      SELECT id
      FROM attribution_responses
      WHERE form_id = ${formId}
        AND awaiting_node_id IS NOT NULL
        AND completed_at IS NULL
        AND created_at < now() - ${`${minutes} minutes`}::interval
      ORDER BY created_at
      LIMIT ${batch}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE attribution_responses r
    SET completed_at = now(), completion = 'abandoned'
    FROM due
    WHERE r.id = due.id
    RETURNING r.id
  `) as Array<{ id: string }>

  return rows.length
}

// --- form and config --------------------------------------------------------

/**
 * The form, and the config snapshot this response is to be validated against.
 *
 * `requestedVersion` is the respondent's claim about what was on their screen. Serving
 * it rather than the current version is the whole point (§5.5 snapshots are immutable
 * and §10.4 makes reconfiguring monthly): a `configure` landing between page load and
 * submit would otherwise reject a candidate the respondent was actually shown and record
 * positions for a list that was never rendered.
 *
 * The version is still scoped to this form by the join. A snapshot belonging to someone
 * else's form would import a foreign candidate set — and, through the composite FK, a
 * response row that cannot be inserted at all.
 */
async function loadForm(formId: string, requestedVersion: number | null): Promise<FormForWrite> {
  // LEFT JOIN so that "form exists but was never configured" is distinguishable from
  // "no such form"; an inner join collapses the two into a 404 the caller cannot act on.
  const rows = (await sql`
    SELECT f.status, f.allowed_origins, f.current_version, c.version, c.nodes, c.root_node_id
    FROM attribution_forms f
    LEFT JOIN attribution_configs c
      ON c.form_id = f.id AND c.version = COALESCE(${requestedVersion}::int, f.current_version)
    WHERE f.id = ${formId}
    LIMIT 1
  `) as Array<{
    status: string
    allowed_origins: string[]
    current_version: number | null
    version: number | null
    nodes: unknown
    root_node_id: string | null
  }>

  const row = rows[0]

  if (!row) {
    throw new ResponseError(404, 'Form not found')
  }

  if (row.version === null || row.root_node_id === null) {
    if (requestedVersion === null) {
      throw new ResponseError(409, 'This form has not been configured yet')
    }

    // attribution_forms_current_version_fk guarantees the current version resolves, so a
    // miss here is the version the caller named — either another form's or none at all.
    throw new ResponseError(400, 'Invalid response payload', [
      `config_version ${requestedVersion} is not a version of this form`,
    ])
  }

  return {
    status: row.status,
    allowed_origins: row.allowed_origins ?? [],
    config_version: row.version,
    root_node_id: row.root_node_id,
    nodes: indexNodes(parseJsonValue<AskNode[]>(row.nodes)),
  }
}

function indexNodes(nodes: AskNode[]): Map<string, AskNode> {
  return new Map((Array.isArray(nodes) ? nodes : []).map((node) => [node.id, node]))
}

/**
 * The follow-up node a pick reveals, if any.
 *
 * An `expands` that does not resolve would leave the response awaiting a node no client
 * can ever answer — i.e. guaranteed abandonment. parseAttributionConfig rejects that, so
 * treating it as "no follow-up" only ever fires on a snapshot written by something else,
 * and losing the follow-up beats losing the response.
 */
function resolveExpansion(
  candidate: Candidate | null,
  nodes: Map<string, AskNode>,
): AskNode | null {
  if (!candidate?.expands) {
    return null
  }

  return nodes.get(candidate.expands) ?? null
}

// --- origin gate ------------------------------------------------------------

/**
 * Billing integrity rather than abuse prevention (§10.3): under per-response pricing an
 * unlisted origin embedding the form spends the owner's quota. An empty allowlist means
 * "not yet configured" and allows everything, so a form works before its host knows its
 * own origins.
 *
 * What is checked is the HOST PAGE's origin, which the embed sends in the body. The
 * `Origin` header cannot serve here: the iframe transport (§11) serves the form from OUR
 * origin, so every embed's fetch is same-origin by construction — including one on a
 * page nobody listed. An exemption for that case is an exemption for the whole embed
 * population, i.e. an allowlist that never denies anything it exists to deny.
 *
 * **`host_origin` is respondent-asserted and therefore a billing-hygiene control, not a
 * security boundary.** Anything running in the browser can put any string there, so what
 * this stops is an honest embed on an origin the owner did not list — a copy-pasted
 * snippet on a staging domain, a partner who forked the page — and not somebody who
 * wants the quota. A real boundary needs a server-side signature from the host, which
 * §5.3 already declines to build for this endpoint. Saying so beats implying a guarantee
 * that is not there.
 *
 * The header is the fallback for a direct cross-origin caller (a host posting from its
 * own JS), which is the one case where it is not our own origin.
 */
function assertOriginAllowed(
  hostOrigin: unknown,
  headerOrigin: string | null,
  selfOrigin: string | null,
  allowed: string[],
) {
  const claimed =
    typeof hostOrigin === 'string' && hostOrigin.length <= MAX_ORIGIN
      ? normalizeOrigin(hostOrigin)
      : null

  // A standalone visit to /s/{id} — the share link, not an embed — reports no host origin
  // at all, because there is no host page. Its request is same-origin with us, so falling
  // through to the Origin header would compare OUR origin against the caller's allowlist
  // and reject it: setting allowed_origins would silently break the share link, and every
  // create example tells the caller to set it.
  //
  // Narrow on purpose, and NOT the same as the same-origin exemption that was removed
  // earlier. That one keyed off the Origin header, which an embedded form's own fetch also
  // sets to our origin — so it exempted every embed, everywhere, and made the allowlist
  // decorative. This keys off the ABSENCE of a claimed host origin: an embed on evil.com
  // claims evil.com and is still checked.
  if (claimed === null && headerOrigin !== null && selfOrigin !== null && headerOrigin === selfOrigin) {
    return
  }

  if (!originAllowed(claimed ?? headerOrigin, allowed)) {
    throw new ResponseError(403, 'This origin is not allowed to submit to this form')
  }
}

/**
 * Empty allowlist allows everything; otherwise the origin must be present and listed.
 *
 * A missing `Origin` header against a non-empty allowlist is a denial: a request we
 * cannot attribute to a listed origin still spends the owner's quota, which is the
 * entire reason the allowlist exists.
 */
export function originAllowed(origin: string | null, allowed: readonly string[]): boolean {
  if (allowed.length === 0) {
    return true
  }

  if (origin === null) {
    return false
  }

  const candidate = normalizeOrigin(origin)

  if (candidate === null) {
    return false
  }

  return allowed.some((entry) => normalizeOrigin(entry) === candidate)
}

/**
 * Compare on scheme + host + port only. A caller who configures
 * "https://checkout.example.com/pay" means the origin, and a mismatch here fails closed
 * on a form that was working a minute earlier — the worst possible failure for a widget
 * embedded in someone else's payment flow.
 */
function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).origin.toLowerCase()
  } catch {
    return null
  }
}

// --- patch token ------------------------------------------------------------

/**
 * Constant-time compare of the stored digest.
 *
 * The token has 192 bits of entropy, so a timing oracle is not the realistic attack.
 * The reason to write it this way anyway is that the alternative — a `===` on a secret
 * — is the line that gets copied into the next place, where the operand is smaller.
 */
function tokenMatches(presented: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(presented), 'hex')
  const b = Buffer.from(storedHash, 'hex')

  return a.length === b.length && timingSafeEqual(a, b)
}

// --- payload ----------------------------------------------------------------

function readAnswer(value: unknown, node: AskNode, errors: string[]): ParsedAnswer | null {
  if (!isRecord(value)) {
    errors.push('answer must be an object')
    return null
  }

  // `false` counts as absent so that a client spreading a full shape
  // ({ candidate_id, dont_remember: false, skipped: false }) is not punished for it.
  const present = (['candidate_id', 'raw', 'dont_remember', 'skipped'] as const).filter(
    (key) => value[key] !== undefined && value[key] !== null && value[key] !== false,
  )

  if (present.length !== 1) {
    // attribution_answers' shape CHECK enforces candidate_id XOR raw at the database,
    // and a constraint violation surfaces as a 500 that tells the caller nothing.
    errors.push(
      `answer must carry exactly one of candidate_id, raw, dont_remember or skipped (got ${present.length})`,
    )
    return null
  }

  const form = present[0]

  if (form === 'candidate_id') {
    const id = readString(value.candidate_id, 'answer.candidate_id', errors, { max: MAX_ID })

    if (id === null) {
      return null
    }

    const candidate = node.candidates.find((entry) => entry.id === id)

    if (!candidate) {
      // Candidate ids are caller-defined (§5.1), so an id absent from the snapshot
      // cannot be stored as one: the rollup would report a bucket that was never in
      // any config and therefore never rendered to anybody. Free text is the path for
      // an answer we do not have an id for.
      errors.push(`answer.candidate_id "${id}" is not a candidate of node "${node.id}"`)
      return null
    }

    // The escape hatch is resolved from the SNAPSHOT, not from the shape of the request.
    // `dont_remember` is a declared property of a candidate (./schema), so a client that
    // submits it as the candidate it is — `{ candidate_id: 'dunno' }`, which is what any
    // headless integrator sends, since it is a row in the list like any other — must not
    // land as kind='candidate'. That row is not a channel: the rollup would report "I
    // don't remember" as a resolved channel holding a share of the responses, while
    // unresolved.dont_remember stayed zero and the reader had no way to see it. The
    // browser picker already translates this pick (CandidatePicker.pick); leaving the
    // semantics to the client means every client has to reimplement them, and the one
    // that does not is indistinguishable from a real answer.
    //
    // `candidate` is dropped along with the id, so a `dont_remember` row carrying
    // `expands` opens no follow-up — the same outcome the picker's `{dont_remember: true}`
    // produces, and §13 is still leaning against giving the escape hatch a second
    // question. Two clients making the same pick have to write the same row.
    //
    // No position is recorded either (selectedIndex needs a candidateId), which is
    // already what happens for this row: §3.5 requires the escape hatch to be
    // pinned: 'end', and positionsOf excludes pinned rows from the impressions map.
    if (candidate.dont_remember) {
      return { kind: 'dont_remember', candidateId: null, raw: null, candidate: null }
    }

    return { kind: 'candidate', candidateId: id, raw: null, candidate }
  }

  if (form === 'raw') {
    if (!node.allow_free_text) {
      errors.push(`node "${node.id}" does not accept free text`)
      return null
    }

    const raw = readRaw(value.raw, errors)

    return raw === null ? null : { kind: 'raw', candidateId: null, raw, candidate: null }
  }

  if (value[form] !== true) {
    errors.push(`answer.${form} must be true when present`)
    return null
  }

  return { kind: form, candidateId: null, raw: null, candidate: null }
}

/**
 * The one string in this module that is not trimmed. §7 stores free text verbatim and
 * derives the remap key from it inside the database; trimming here would be a second
 * normalization rule that an ALTER on the generated column could not reach.
 */
function readRaw(value: unknown, errors: string[]): string | null {
  if (typeof value !== 'string') {
    errors.push('answer.raw must be a string')
    return null
  }

  if (value.trim().length === 0) {
    errors.push('answer.raw must not be empty')
    return null
  }

  if (value.length > MAX_RAW) {
    errors.push(`answer.raw must be at most ${MAX_RAW} characters`)
    return null
  }

  const unstorable = unstorableReason(value)

  if (unstorable) {
    errors.push(`answer.raw must not contain ${unstorable}`)
    return null
  }

  return value
}

/**
 * `{candidate_id: rendered_index}` for the initial, unfiltered render of one node — the
 * single source of rendered-position truth for both writes.
 *
 * Derived, never read from the body. §5.3's job for `render_id` is that "the same
 * render_id must reproduce the same order", and orderCandidates is pure, so recomputing
 * the map from (render_id, config snapshot, node) does not check a client's claim, it
 * replaces it. That is what makes §6.2's numerator as unforgeable as its denominator: a
 * request can no longer assert `{a: 0, b: 0, c: 0}` and book five hundred impressions at
 * position 0, nor assert its own pick's index, because neither number appears in it.
 *
 * The cost, stated plainly: if the picker's real render ever diverged from what this
 * recomputes, nothing would detect it. That is the better half of the trade — the
 * previous design detected it by rejecting the whole submission, which loses the same
 * impressions plus the answer and the respondent's time.
 *
 * Which rows are in the map, and therefore which selections can carry an index, is
 * positionsOf's decision alone (pinned out, past-MAX_VISIBLE out). See order.ts.
 *
 * A headless integrator rendering its own UI now has impressions recorded for the order
 * WE would have rendered, where before it could send none. That is the honest limit of
 * what a `render_id` can attest to, and it is the cheaper error: the alternative is
 * believing a map the request supplied, which is the forgeable denominator this change
 * exists to delete.
 */
function renderOf(node: AskNode, renderId: string): Record<string, number> {
  return positionsOf(orderCandidates(node.candidates, node.order, renderId))
}

/**
 * The rendered index of the answer itself, looked up in the very map that will be stored
 * as this response's impressions.
 *
 * The rollup reads §6.2's numerator off attribution_answers.position and its denominator
 * off attribution_responses.positions, so the two have to describe the same event or the
 * fit is biased by the disagreement rather than by the position effect. Taking both from
 * one object is the only arrangement where that cannot drift.
 *
 * Null in three cases, all of them "no position exists" rather than "position unknown":
 * an answer that named no candidate (raw, dont_remember, skipped); a candidate absent
 * from the map, which today means pinned or past the visible cap; and a pick the client
 * flagged as search-filtered. The last one is the only remaining use of
 * `selected_via_search`, and it can only ever suppress a position, never invent one —
 * §5.3 excludes those picks because someone who types "jad" and takes the only match
 * would otherwise book a position-0 selection against an impression the rest of the list
 * never competed for. A client that lies about the flag withholds its own data point and
 * nothing else, which is why it is still allowed to be client-supplied: the server
 * genuinely cannot know it.
 */
function selectedIndex(
  rendered: Record<string, number>,
  answer: ParsedAnswer,
  selectedViaSearch: boolean,
): number | null {
  if (selectedViaSearch || answer.candidateId === null) {
    return null
  }

  // Object.hasOwn rather than a bare lookup with `?? null`. positionsOf builds a
  // null-prototype map so this is belt-and-braces there, but this function also runs
  // against maps rehydrated from jsonb, which arrive as ordinary objects — and a
  // candidate id of `toString` or `constructor` would then resolve through the
  // prototype to a function that `??` happily passes through to an INT column.
  return Object.hasOwn(rendered, answer.candidateId) ? rendered[answer.candidateId] : null
}

/**
 * The config version the respondent was rendered against (§5.3).
 *
 * Bounded by int4 because that is the column's type: a larger number reaches the driver
 * and comes back as "integer out of range", i.e. a 500 on a public endpoint for what is
 * a malformed field.
 */
function readVersion(value: unknown, errors: string[]): number | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_INT4) {
    errors.push('config_version must be a positive integer')
    return null
  }

  return value
}

function readFlag(value: unknown, where: string, errors: string[]): boolean {
  if (value === undefined || value === null) {
    return false
  }

  if (typeof value !== 'boolean') {
    errors.push(`${where} must be a boolean`)
    return false
  }

  return value
}

function readString(
  value: unknown,
  where: string,
  errors: string[],
  options: { required?: boolean; max: number },
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

/**
 * The form id off the route path, held to the same rules as any id in the body.
 *
 * It looks like routing rather than input, which is how it went unvalidated: a POST to
 * /api/attribution/forms/%00/responses decodes to a NUL that flowed straight into a bind
 * parameter, so the endpoint answered a malformed URL with a 500 and a raw driver error.
 * Errors are discarded rather than surfaced — the callers turn a rejection into the same
 * answer an id that simply does not exist gets, so there is no message to attach.
 */
function readRouteFormId(formId: unknown): string | null {
  return readString(formId, 'form id', [], { required: true, max: MAX_ID })
}

/**
 * Metadata is capped and coerced by sanitizeMetadata, which predates this endpoint and
 * says nothing about either hazard — so a NUL or a lone surrogate in a host's response
 * tag still reaches the driver inside a ::jsonb bind parameter and comes back as a 500.
 * Checked here rather than there because the caps in lib/metadata.ts serve the survey
 * path too, and this is the boundary where an anonymous body arrives.
 *
 * Deliberately run on the SANITIZED map, not on the body: sanitizeMetadata truncates
 * with slice(), which cuts by code unit, so a tag ending in an emoji at the length cap
 * comes out of it holding half a surrogate pair that the input never contained.
 */
function assertMetadataStorable(metadata: Record<string, string>, errors: string[]) {
  for (const [key, value] of Object.entries(metadata)) {
    const unstorable = unstorableReason(key) ?? unstorableReason(value)

    if (unstorable) {
      errors.push(`metadata["${key}"] must not contain ${unstorable}`)
    }
  }
}

/**
 * Why a string cannot be stored, or null if it can. One function so that every
 * respondent-supplied string on this endpoint — body field, free text, metadata, route
 * param — is held to one rule. The control-character check was written per field, and
 * the surrogate hazard then had to be closed in every one of those places separately;
 * the next such character class should be a two-line change here instead.
 */
function unstorableReason(value: string): string | null {
  if (CONTROL_CHARACTERS.test(value)) {
    return 'control characters'
  }

  if (LONE_SURROGATE.test(value)) {
    return 'unpaired UTF-16 surrogates'
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
