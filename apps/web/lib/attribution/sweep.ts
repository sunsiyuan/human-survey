import { sweepAbandoned } from './responses'

/**
 * Close out responses that opened a follow-up and never came back.
 *
 * This exists because `sweepAbandoned` shipped with no callers, and the consequence was
 * not a missing feature — it was two silently wrong numbers. An unswept response has a
 * null `completed_seq`, so the visibility gate (§5.4) correctly withholds it from cursor
 * reads and from the rollup; without a sweep it is withheld FOREVER. The respondent's
 * channel answer — real data, already durable — is never delivered, and
 * `followup_abandoned` reads a permanent 0.0 while the rollup's own notes claim it
 * measures abandonment.
 *
 * Wired lazily to the authenticated reads rather than to a schedule, on purpose:
 *
 *   - It needs no cron infrastructure, no shared secret, and no `vercel.json`, so there
 *     is no second deployment surface that can silently stop running. A cron that dies
 *     looks exactly like a form nobody abandoned.
 *   - The work is bounded by the same batch limit `sweepAbandoned` already enforces,
 *     which matters because each swept row takes the completion trigger's row lock on the
 *     form until commit — an unbounded sweep would block live respondents.
 *   - It is self-healing in the only direction anyone notices: whoever asks for the data
 *     is the one who pays for making it correct first.
 *
 * The cost is that a form nobody reads accumulates open rows indefinitely. That is
 * acceptable — the rows are correct and durable, they are simply undelivered, and the
 * first read repairs them. If a scheduled sweep is ever added, it should call
 * `sweepAbandoned` directly rather than going through here.
 */

/**
 * §13 leaves the real threshold open, to be chosen from data rather than guessed.
 *
 * Thirty minutes is the placeholder, biased long. Too short misrecords a slow respondent
 * — someone who opens a checkout, reads the follow-up, gets interrupted, and comes back —
 * as an abandonment, and that error is invisible afterwards because the two look
 * identical in the data. Too long only delays delivery of an answer that is already
 * stored, and an agent reading on a monthly cadence (§10.4) cannot tell.
 */
export const DEFAULT_ABANDON_MINUTES = 30

// Per-process memo, not a distributed lock. Two instances sweeping the same form at once
// is harmless: the statement takes its rows FOR UPDATE SKIP LOCKED, so the second one
// simply finds fewer. This only stops one instance from re-running the probe on every
// request of a burst.
const lastSwept = new Map<string, number>()

const MIN_INTERVAL_MS = 60_000

export async function ensureSwept(
  formId: string,
  olderThanMinutes: number = DEFAULT_ABANDON_MINUTES,
): Promise<number> {
  const now = Date.now()
  const previous = lastSwept.get(formId)

  if (previous !== undefined && now - previous < MIN_INTERVAL_MS) {
    return 0
  }

  lastSwept.set(formId, now)

  try {
    return await sweepAbandoned(formId, olderThanMinutes)
  } catch {
    // A read must not fail because the repair failed. The numbers are then stale rather
    // than wrong — the withheld rows stay withheld, which is the state the caller would
    // have seen anyway a second earlier — and the next read tries again.
    return 0
  }
}
