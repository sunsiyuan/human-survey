/**
 * Run with: pnpm test  (node --test, no framework)
 *
 * §6.1 rests the whole "no correction needed under rotate" claim on the permutation
 * being uniform, and the write path rests on it being reproducible — the server derives
 * the stored impressions map AND the answer's position by re-running these functions
 * over (config, render_id). Neither property announces itself when it breaks: a biased
 * shuffle still returns a plausible list, and a non-reproducible one still renders. So
 * both are asserted here, the second one statistically rather than taken on trust.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MAX_VISIBLE, orderCandidates, positionsOf } from './order.ts'
import type { Candidate } from './schema.ts'

function candidate(id: string, extra: Partial<Candidate> = {}): Candidate {
  return { id, label: id.toUpperCase(), ...extra }
}

const orderable: Candidate[] = [
  candidate('tiktok'),
  candidate('instagram'),
  candidate('youtube'),
  candidate('google'),
  candidate('chatgpt'),
  candidate('reddit'),
  candidate('linkedin'),
  candidate('friend'),
]

const dunno = candidate('dunno', { label: "I don't remember", pinned: 'end' })

const withPinned: Candidate[] = [...orderable, dunno]

function ids(candidates: Candidate[]): string[] {
  return candidates.map((c) => c.id)
}

describe('orderCandidates — fixed', () => {
  it('returns the caller order untouched', () => {
    assert.deepEqual(ids(orderCandidates(orderable, 'fixed', 'V1StGXR8_Z5j')), ids(orderable))
  })

  it('ignores the render id', () => {
    assert.deepEqual(
      ids(orderCandidates(orderable, 'fixed', 'aaa')),
      ids(orderCandidates(orderable, 'fixed', 'bbb')),
    )
  })
})

describe('orderCandidates — pinned segment', () => {
  it('puts a pinned candidate last in both modes', () => {
    for (const mode of ['fixed', 'rotate'] as const) {
      for (const renderId of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']) {
        const result = ids(orderCandidates(withPinned, mode, renderId))
        assert.equal(result[result.length - 1], 'dunno', `${mode}/${renderId} did not pin last`)
      }
    }
  })

  it('pins last even when the caller wrote it in the middle of a fixed list', () => {
    // §3.5 makes pinning a property of the candidate, not an ordering mode. A caller
    // who lists "I don't remember" third and asks for `fixed` still gets it last.
    const middle = [orderable[0], dunno, orderable[1]]

    assert.deepEqual(ids(orderCandidates(middle, 'fixed', 'r')), ['tiktok', 'instagram', 'dunno'])
  })

  it('keeps several pinned entries in their original relative order', () => {
    // The validator caps a node at one, but historical snapshots were written under
    // whatever it said at the time, and an old node must not reshuffle when re-rendered.
    const two = [orderable[0], candidate('zeta', { pinned: 'end' }), dunno, orderable[1]]
    const result = ids(orderCandidates(two, 'rotate', 'seed'))

    assert.deepEqual(result.slice(-2), ['zeta', 'dunno'])
  })

  it('never rotates the pinned entry into the orderable segment', () => {
    // If it rotated, some respondents would meet the escape hatch at position 0, where
    // it competes with the candidates — and §6.2 excludes pinned from the model, so
    // those impressions would be unaccounted for on both sides.
    for (let i = 0; i < 500; i += 1) {
      const result = ids(orderCandidates(withPinned, 'rotate', `render-${i}`))
      assert.equal(result.indexOf('dunno'), result.length - 1)
    }
  })
})

describe('orderCandidates — rotate', () => {
  it('is deterministic for a given render id', () => {
    // The property that makes a reload stable and makes the stored positions map
    // underivable from the request body: the server recomputes this from the submitted
    // render_id and stores the result, so a client has nothing to assert.
    for (const renderId of ['V1StGXR8_Z5j', '', 'a', '同一个渲染', 'render-0']) {
      const first = ids(orderCandidates(withPinned, 'rotate', renderId))

      for (let i = 0; i < 5; i += 1) {
        assert.deepEqual(ids(orderCandidates(withPinned, 'rotate', renderId)), first)
      }
    }
  })

  it('produces different orders across render ids', () => {
    const seen = new Set<string>()

    for (let i = 0; i < 200; i += 1) {
      seen.add(ids(orderCandidates(orderable, 'rotate', `render-${i}`)).join(','))
    }

    assert.ok(seen.size > 150, `expected many distinct orders, got ${seen.size}`)
  })

  it('is a true permutation — no drops, no duplicates', () => {
    const expected = [...ids(withPinned)].sort()

    for (let i = 0; i < 2000; i += 1) {
      const result = ids(orderCandidates(withPinned, 'rotate', `render-${i}`))

      assert.equal(result.length, withPinned.length)
      assert.deepEqual([...result].sort(), expected)
    }
  })

  it('does not mutate the caller array', () => {
    // The input is a config snapshot shared by every render of that version. Shuffling
    // it in place would make each respondent's order depend on the previous one's.
    const input = [...withPinned]
    orderCandidates(input, 'rotate', 'seed')

    assert.deepEqual(ids(input), ids(withPinned))
  })

  it('handles empty and single-candidate nodes', () => {
    assert.deepEqual(orderCandidates([], 'rotate', 'seed'), [])
    assert.deepEqual(ids(orderCandidates([dunno], 'rotate', 'seed')), ['dunno'])
  })
})

describe('orderCandidates — positional uniformity', () => {
  it('lands each orderable candidate in each position at roughly equal rates', () => {
    // This is the assertion §6.1's "the raw share is unbiased by construction" is
    // actually making. If the shuffle skews — a modulo-biased index, a Fisher-Yates
    // written with the wrong bound, a seed hash whose low bits leak into the first
    // draw — the ordering still looks shuffled and the whole rollup silently inherits
    // the bias it exists to remove.
    //
    // Fixed render ids make this deterministic: it cannot flake, it can only be wrong.
    const trials = 8000
    const n = orderable.length
    const counts = orderable.map(() => new Array<number>(n).fill(0))
    const indexOf = new Map(orderable.map((c, i) => [c.id, i]))

    for (let i = 0; i < trials; i += 1) {
      ids(orderCandidates(withPinned, 'rotate', `render-${i}`)).forEach((id, position) => {
        const row = indexOf.get(id)

        if (row !== undefined) {
          counts[row][position] += 1
        }
      })
    }

    const expected = trials / n
    // ±15% of expected is ~5 standard deviations at this sample size, so a shuffle that
    // is actually uniform has no realistic way to trip it, while a one-position skew of
    // the kind an off-by-one produces is many times larger than the band.
    const tolerance = expected * 0.15

    for (let row = 0; row < n; row += 1) {
      for (let position = 0; position < n; position += 1) {
        const observed = counts[row][position]

        assert.ok(
          Math.abs(observed - expected) <= tolerance,
          `${orderable[row].id} at position ${position}: ${observed} vs expected ${expected}`,
        )
      }
    }
  })
})

describe('positionsOf', () => {
  it('maps candidate id to rendered index', () => {
    // Spread before comparing: the map is deliberately null-prototype (see positionsOf,
    // and the hostile-id suite below), and deepStrictEqual compares prototypes, so a
    // direct comparison against an object literal fails for a reason that has nothing
    // to do with the mapping being right.
    assert.deepEqual({ ...positionsOf([candidate('a'), candidate('b'), candidate('c')]) }, {
      a: 0,
      b: 1,
      c: 2,
    })
  })

  it('omits the pinned entry', () => {
    // §6.2 excludes pinned options from rotation AND from the model, so they are absent
    // from the map rather than present-and-ignored. This is the single definition of the
    // rule: the write path derives the stored impressions map and the answer's position
    // from this one object, so a pinned pick gets a null position for the same reason it
    // contributes no impression — not because a second rule somewhere else says so.
    const positions = positionsOf(orderCandidates(withPinned, 'rotate', 'seed'))

    assert.equal(positions.dunno, undefined)
    assert.equal(Object.keys(positions).length, withPinned.length - 1)
  })

  it('agrees with the rendered order it was built from, for every non-pinned row', () => {
    const rendered = orderCandidates(withPinned, 'rotate', 'V1StGXR8_Z5j')
    const positions = positionsOf(rendered)

    rendered.forEach((c, index) => {
      assert.equal(positions[c.id], c.pinned === 'end' ? undefined : index)
    })
  })

  it('leaves the orderable indices contiguous from zero once pinned is dropped', () => {
    // Pinned sorts last, so dropping it must not punch a hole in the middle of the
    // sequence: §6.2 buckets selections by index, and a gap would create a position
    // that no impression was ever booked at.
    const positions = positionsOf(orderCandidates(withPinned, 'rotate', 'seed'))
    const indices = [...Object.values(positions)].sort((a, b) => a - b)

    assert.deepEqual(indices, [...Array(withPinned.length - 1).keys()])
  })
})

describe('positionsOf — the MAX_VISIBLE cap', () => {
  // A node may carry 500 candidates and the picker renders twelve of them. Counting the
  // other 488 as impressions gives §6.2 a denominator describing rows that were never in
  // the DOM, which shows up as a position effect that is purely an artifact of the cap.
  const many: Candidate[] = Array.from({ length: 40 }, (_, i) => candidate(`c${i}`))

  it('emits one index per rendered row and no more', () => {
    const positions = positionsOf(orderCandidates(many, 'rotate', 'seed'))

    assert.equal(Object.keys(positions).length, MAX_VISIBLE)
    assert.deepEqual([...Object.values(positions)].sort((a, b) => a - b), [
      ...Array(MAX_VISIBLE).keys(),
    ])
  })

  it('counts the first MAX_VISIBLE of the rendered order, not of the caller array', () => {
    const rendered = orderCandidates(many, 'rotate', 'seed')
    const positions = positionsOf(rendered)

    rendered.slice(0, MAX_VISIBLE).forEach((c, index) => {
      assert.equal(positions[c.id], index)
    })

    for (const c of rendered.slice(MAX_VISIBLE)) {
      assert.equal(positions[c.id], undefined)
    }
  })

  it('never counts the pinned row, whatever the cap did to the orderable segment', () => {
    // The escape hatch is on screen either way (§3.5), but it is out of the model (§6.2),
    // and the cap must not smuggle it back in at index MAX_VISIBLE. A stored impression
    // at that index with no selection ever able to match it — the write path reads the
    // selection out of this same map — is a phantom row in §6.2's denominator.
    const positions = positionsOf(orderCandidates([...many, dunno], 'rotate', 'seed'))

    assert.equal(positions.dunno, undefined)
    assert.equal(Object.keys(positions).length, MAX_VISIBLE)
  })

  it('leaves a list shorter than the cap untouched apart from the pinned row', () => {
    const rendered = orderCandidates(withPinned, 'rotate', 'seed')

    assert.ok(withPinned.length <= MAX_VISIBLE)
    assert.equal(Object.keys(positionsOf(rendered)).length, withPinned.length - 1)
  })

  it('fills the cap from the orderable segment even when a pinned row is present', () => {
    // The pinned row costs the orderable segment nothing: it is not a member of the
    // capped population, so a node with exactly MAX_VISIBLE orderable candidates plus an
    // escape hatch still books all MAX_VISIBLE of them as impressions.
    const exact = Array.from({ length: MAX_VISIBLE }, (_, i) => candidate(`c${i}`))
    const positions = positionsOf(orderCandidates([...exact, dunno], 'rotate', 'seed'))

    assert.equal(Object.keys(positions).length, MAX_VISIBLE)
    assert.equal(positions.dunno, undefined)
  })
})

describe('positionsOf — hostile candidate ids', () => {
  // Candidate ids are caller-defined arbitrary strings (§5.1), so the names that mean
  // something to a JavaScript object are all legal ids. On a plain object literal
  // `__proto__` is swallowed by the prototype setter and `toString` reads back as a
  // function; both reach the database as a hole in the impressions map or as a
  // function bound to an INT column, and neither shows up in a type check.
  const hostile = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']

  it('stores every reserved-name id as an ordinary key', () => {
    const candidates = hostile.map((id) => ({ id, label: id }))
    const positions = positionsOf(orderCandidates(candidates, 'fixed', 'seed'))

    assert.deepEqual(
      Object.keys(positions).sort(),
      [...hostile].sort(),
      'every id must round-trip as its own key',
    )

    hostile.forEach((id, index) => {
      assert.equal(positions[id], index, `${id} must keep its rendered index`)
    })
  })

  it('does not report a position for an absent reserved name', () => {
    const positions = positionsOf(orderCandidates([{ id: 'tiktok', label: 'TikTok' }], 'fixed', 's'))

    for (const id of hostile) {
      assert.equal(
        (positions as Record<string, unknown>)[id],
        undefined,
        `${id} must be absent, not inherited from Object.prototype`,
      )
    }
  })

  it('survives a JSON round trip, which is how it reaches jsonb', () => {
    const candidates = hostile.map((id) => ({ id, label: id }))
    const positions = positionsOf(orderCandidates(candidates, 'fixed', 'seed'))
    const roundTripped = JSON.parse(JSON.stringify(positions)) as Record<string, number>

    assert.deepEqual(Object.keys(roundTripped).sort(), [...hostile].sort())
  })
})
