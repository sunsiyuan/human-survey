import { NextResponse } from 'next/server'

import { configErrorResponse } from '@/lib/attribution/config'
import { getRollup, parseRollupQuery, RollupQueryError } from '@/lib/attribution/rollup'
import { ensureSwept } from '@/lib/attribution/sweep'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/attribution/rollup?form_id=…&by=node|candidate&metric=responses|revenue&from=&to=
 *
 * The aggregate read surface (§7), and §10.4's `get_attribution` tool underneath. There is
 * no human-facing dashboard on purpose — §11.2 reconciles the ROADMAP's "no results
 * dashboard" line with this endpoint by making the agent the dashboard.
 *
 * A collection route rather than /forms/{id}/rollup because `form_id` is a query
 * parameter in the documented shape (§7) and in every §10 tool signature. Keeping one
 * spelling matters more here than REST tidiness: the MCP tool, the docs and the URL are
 * read by the same agent in one session.
 *
 * The body deviates from §7's sketch in three places, deliberately, and each is argued at
 * the head of lib/attribution/rollup.ts: `followup_abandoned` is split into it and
 * `followup_unresolved` (the sketch's one field named an abandonment rate and computed a
 * coverage rate); both are arrays of explicitly-keyed objects rather than a map keyed
 * `node:candidate` (caller-defined ids collide in that key); and revenue ships as a
 * top-level block, with per-row revenue only on the root node's rows (the sketch repeated
 * one response's money on every node it answered). §7 wants updating to match — the
 * divergence is the payload being right, not the payload drifting.
 */

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  try {
    const query = parseRollupQuery(new URL(request.url))
    // Repair before reading. An unswept response is withheld from every consumer by the
    // visibility gate (§5.4), so without this followup_abandoned reads a permanent 0.0 and
    // the channel answers of everyone who abandoned a follow-up are never counted at all.
    // Bounded and rate-limited inside ensureSwept.
    await ensureSwept(query.formId)

    const rollup = await getRollup(auth.accountId, query)

    return NextResponse.json(rollup)
  } catch (error) {
    if (error instanceof RollupQueryError) {
      // Every problem at once, like AttributionConfigError: an agent fixing a query one
      // error per round trip burns a turn per typo.
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 })
    }

    // Reuses the config module's mapping so that FormNotFoundError answers 404 here
    // exactly as it does on the configure routes — the conflation of "no such form" with
    // "not your form" has to hold on every route or the id space becomes enumerable
    // through whichever one forgot.
    const response = configErrorResponse(error)

    if (response) {
      return response
    }

    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
