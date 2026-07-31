/**
 * Run with: pnpm test  (node --test, no framework)
 *
 * These exist because this parser was duplicated and the two copies disagreed.
 * `rollup.ts` appended "Z" to a zoneless date-time; `remap.ts` called bare `Date.parse`,
 * which the ES spec reads in the RUNTIME's local zone for that form. So the same
 * `from=2026-07-01T00:00:00` selected two different windows depending on which endpoint
 * received it, on any host not running UTC — eight hours apart under Asia/Shanghai, which
 * walks a month boundary onto the previous calendar day.
 *
 * Nothing failed. Both endpoints returned confident numbers over different response sets,
 * and the unresolved route's own header comment promised they would reconcile.
 *
 * The assertions below are absolute instants on purpose. A test that compared the two
 * parsers to each other would pass just as happily if both drifted, and a test that used
 * the local zone to compute its expectation would encode the bug as the expectation.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readInstant } from './window.ts'

function parse(value: string): { instant: string | null; errors: string[] } {
  const errors: string[] = []
  return { instant: readInstant(value, 'from', errors), errors }
}

describe('readInstant — zoneless values are UTC, whatever the host thinks', () => {
  it('reads a plain date as UTC midnight', () => {
    assert.equal(parse('2026-07-01').instant, '2026-07-01T00:00:00.000Z')
  })

  it('reads a zoneless date-time as UTC, not as local time', () => {
    // Under the old remap.ts parser this was 2026-06-30T16:00:00.000Z on a UTC+8 host:
    // the previous calendar day, for a caller who wrote the month boundary out in full.
    assert.equal(parse('2026-07-01T00:00:00').instant, '2026-07-01T00:00:00.000Z')
  })

  it('reads a space separator the same as a T', () => {
    assert.equal(parse('2026-07-01 09:30').instant, '2026-07-01T09:30:00.000Z')
    assert.equal(parse('2026-07-01T09:30').instant, '2026-07-01T09:30:00.000Z')
  })

  it('keeps fractional seconds', () => {
    assert.equal(parse('2026-07-01T00:00:00.500').instant, '2026-07-01T00:00:00.500Z')
  })

  it('leaves an explicit offset alone rather than double-applying one', () => {
    assert.equal(parse('2026-07-01T00:00:00Z').instant, '2026-07-01T00:00:00.000Z')
    assert.equal(parse('2026-07-01T08:00:00+08:00').instant, '2026-07-01T00:00:00.000Z')
    assert.equal(parse('2026-07-01T00:00:00-05:00').instant, '2026-07-01T05:00:00.000Z')
  })

  it('treats absent and blank as no bound, not as an error', () => {
    assert.equal(readInstant(null, 'from', []), null)
    assert.equal(parse('   ').instant, null)
    assert.deepEqual(parse('   ').errors, [])
  })

  it('reports an unparseable bound instead of silently dropping it', () => {
    const { instant, errors } = parse('last tuesday')
    assert.equal(instant, null)
    assert.equal(errors.length, 1)
    // A dropped bound would widen the window to all time and report numbers for it.
    assert.match(errors[0], /^from must be an ISO 8601 date or timestamp/)
  })

  it('is independent of the process timezone', () => {
    // The suite runs under whatever TZ the developer has; this pins the property that the
    // duplicate parser violated, rather than trusting the ambient one to be UTC.
    const zoneless = ['2026-01-15T00:00:00', '2026-07-01 09:30', '2026-12-31T23:59:59']
    const expected = ['2026-01-15T00:00:00.000Z', '2026-07-01T09:30:00.000Z', '2026-12-31T23:59:59.000Z']

    assert.deepEqual(
      zoneless.map((value) => parse(value).instant),
      expected,
    )
  })
})
