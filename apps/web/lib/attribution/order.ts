import type { Candidate } from './schema'

/**
 * Deterministic candidate ordering, and the input side of the position model.
 *
 * Design contract: docs/design/attribution-pivot.md §3.5, §6.1.
 *
 * Order affects results — options shown earlier are selected at systematically higher
 * rates — which is why `rotate` is the default: every option spends equal expected time
 * at every position, so the raw share comes out unbiased with no correction to apply.
 * That claim is only true if the permutation is uniform, so the shuffle below is a
 * plain Fisher-Yates rather than anything cleverer.
 *
 * This lives in lib/ rather than in the picker component because it has two callers,
 * not one. The browser renders the order; the server RECOMPUTES it from the submitted
 * `render_id` and stores what comes out (§5.3). The recomputation is not a check against
 * a client-sent map — there is no client-sent map any more — it IS the map, so a caller
 * cannot forge an impressions denominator or a selection index by asserting one. That
 * only holds while this function is pure, so its output depends on nothing but its
 * arguments.
 *
 * Which is also why `Math.random` appears nowhere here. A randomly-shuffled list would
 * be unrecomputable: the server would have nothing to derive positions from, and a
 * reload would reshuffle the options under the respondent's cursor mid-answer.
 */

/**
 * Split into an orderable segment and a pinned segment, order the first, append the
 * second. `fixed` leaves the orderable segment in the caller's array order.
 *
 * Pinning survives `fixed` on purpose. It is a property of the candidate, not an
 * ordering mode: a caller who writes "I don't remember" in the middle of a `fixed`
 * array still gets it rendered last, because §3.5's requirement is about where the
 * respondent's eye finds the escape hatch, not about which mode the node is in.
 *
 * `renderId` is ignored under `fixed`. It is still required rather than optional so a
 * caller cannot flip a node to `rotate` and discover at runtime that the seed was never
 * being threaded through.
 */
export function orderCandidates(
  candidates: Candidate[],
  order: 'fixed' | 'rotate',
  renderId: string,
): Candidate[] {
  const orderable: Candidate[] = []
  const pinned: Candidate[] = []

  for (const candidate of candidates) {
    if (candidate.pinned === 'end') {
      pinned.push(candidate)
    } else {
      orderable.push(candidate)
    }
  }

  // The schema validator caps a node at one pinned entry, but this function is also
  // reached with historical config snapshots, which were written under whatever the
  // validator said at the time. Keeping their relative order makes an old multi-pinned
  // node render the same way it did then, instead of quietly reshuffling history.
  const head = order === 'rotate' ? shuffle(orderable, mulberry32(seedFrom(renderId))) : orderable

  return [...head, ...pinned]
}

/**
 * How many orderable candidates render before search has to carry the rest (§3.4).
 *
 * Exported because it is not a picker detail: it decides which rows exist in the DOM,
 * and therefore which rows `positionsOf` may count as impressions. A node may hold 500
 * candidates (§5.1) and the picker shows twelve of them, so the two constants have to
 * be the same constant or §6.2's denominator describes rows nobody was shown.
 */
export const MAX_VISIBLE = 12

/**
 * The `positions` map for a rendered node: candidate id → rendered index (§5.3).
 *
 * This is the ONLY definition of "which rows count as impressions, and at what index".
 * The server derives both sides of §6.2's ratio from it — the stored impressions map and
 * the answer's own `position`, by looking the chosen id up in the very same object — so
 * the numerator and the denominator cannot disagree about a row the way they did when
 * one came from the client and the other from here.
 *
 * Two exclusions, and both have to be exclusions from the WHOLE map for that to hold:
 *
 * Orderable candidates past `MAX_VISIBLE` are absent rather than carrying a large index.
 * An impression is a claim that a respondent could have chosen that option, and rows
 * that search never surfaced were never in the DOM. Counting all 500 (§5.1) would
 * inflate every `n[j][p]` denominator while the selections stayed where they were, which
 * reads as a huge position effect that is entirely an artifact of the cap.
 *
 * Pinned entries are absent too, which is a reversal: §6.2 excludes pinned options from
 * both rotation and the model, and emitting an impression the fitter is then required to
 * drop puts the pinned rule in two places — here and in the fitter — which is exactly the
 * split that let the write path record a pinned pick at index MAX_VISIBLE while the
 * picker reported none. The map stays reproducible from (config, render_id) either way,
 * because reproducing it means calling this function, not replaying a stored render.
 *
 * A caller that needs to know where a pinned row rendered still has `orderCandidates`,
 * which returns the full list; what is dropped here is only its claim on the model.
 */
export function positionsOf(ordered: Candidate[]): Record<string, number> {
  // Object.create(null), not {}. Candidate ids are caller-defined arbitrary strings
  // (§5.1), so `__proto__` is a legal id — and assigning it on an ordinary object
  // literal invokes the prototype setter instead of storing a key, silently dropping
  // that candidate from the impressions map and leaving a hole in the sequence.
  // Inherited names are the same hazard read back: `positions['toString']` on a plain
  // object returns a function rather than undefined, so `?? null` never fires and a
  // function reaches an INT column. A null-prototype object has neither problem, and
  // JSON.stringify treats it exactly like a plain one on the way to jsonb.
  const positions: Record<string, number> = Object.create(null)
  let index = 0

  for (const candidate of ordered) {
    if (candidate.pinned === 'end') {
      continue
    }

    if (index >= MAX_VISIBLE) {
      break
    }

    positions[candidate.id] = index
    index += 1
  }

  return positions
}

// --- PRNG -------------------------------------------------------------------

/**
 * FNV-1a, 32-bit.
 *
 * Hand-rolled rather than delegated to a hash the platform already provides, because
 * this exact function has to run in the browser before first paint and on the server
 * inside a request handler. `node:crypto` is server-only, and `crypto.subtle.digest` is
 * async — an async seed would mean either a paint before the order is known (the list
 * visibly reshuffling) or a blocked first render.
 *
 * A 32-bit seed collides across render ids after a few tens of thousands of responses.
 * That is not a defect here: the output space is n! permutations of a dozen-odd options
 * to begin with, so two respondents sharing an order is already the common case, and
 * nothing downstream assumes render ids map to distinct orders.
 */
function seedFrom(renderId: string): number {
  let hash = 0x811c9dc5

  for (let i = 0; i < renderId.length; i += 1) {
    hash ^= renderId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

/**
 * mulberry32. Chosen for one property that matters more than statistical pedigree:
 * a 32-bit state that survives being handed a seed from an adjacent string.
 *
 * Render ids arriving in a batch are frequently near-identical (`nanoid` output shares
 * an alphabet; test fixtures share a prefix), so `seedFrom` hands this consecutive-ish
 * integers. mulberry32's step constant and two mixing rounds decorrelate those, where a
 * bare LCG or xorshift would emit visibly similar first draws — and the first draw is
 * the one that picks which option lands at the top of the list.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0

    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fisher-Yates, copying rather than shuffling in place — the caller's array is a config
 * snapshot shared across every render of that version, and mutating it would make the
 * second respondent's order depend on the first respondent's.
 */
function shuffle<T>(items: T[], next: () => number): T[] {
  const out = [...items]

  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    const held = out[i]
    out[i] = out[j]
    out[j] = held
  }

  return out
}
