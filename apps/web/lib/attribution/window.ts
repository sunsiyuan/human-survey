/**
 * The one parser for a `from` / `to` bound, shared by every read that takes a window.
 *
 * It lives in its own module because there were two of these. `rollup.ts` normalized a
 * zoneless date-time to UTC by appending "Z"; `remap.ts` called bare `Date.parse`. The ES
 * spec parses the date-only form ("2026-07-01") as UTC but a date-TIME form with no offset
 * ("2026-07-01T00:00:00") in the RUNTIME's local zone — so on any host not running UTC, the
 * same pair of parameters selected two different windows depending on which endpoint you
 * sent them to, silently, offset by the host's UTC offset.
 *
 * Nothing in either payload said so, and the unresolved route's own header comment promised
 * the opposite: "both matching the rollup, so a caller can hand the same pair to either
 * endpoint and get numbers that reconcile." That promise is the reason this is one function
 * now rather than two that agree today.
 *
 * The failure was invisible on the common input. Plain dates agreed in every timezone, so
 * only a caller who wrote out the midnight — "2026-07-01T00:00:00", which plainly means the
 * same thing to whoever typed it — was affected, and only off UTC.
 */

// A date-time carrying no zone offset: "2026-07-01T00:00:00", "2026-07-01 09:30",
// "2026-07-01T00:00:00.500". Anything with a trailing Z or ±hh:mm fails this and is left
// exactly as the caller wrote it.
const ZONELESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/

/**
 * A timestamp bound, normalized to an instant.
 *
 * Zoneless values are read as UTC, and that has to be done explicitly — see above.
 *
 * Rejecting the zoneless form instead would also have been defensible, but a month
 * boundary is the overwhelmingly common bound here.
 */
export function readInstant(value: string | null, where: string, errors: string[]): string | null {
  if (value === null) {
    return null
  }

  const text = value.trim()

  if (text.length === 0) {
    return null
  }

  // The separator is normalized to "T" along with the zone: a space separator is
  // implementation-defined under the spec, so appending "Z" to it would be trading one
  // host-dependent parse for another.
  const normalized = ZONELESS_DATE_TIME.test(text) ? `${text.replace(/[Tt ]/, 'T')}Z` : text
  const parsed = new Date(normalized)

  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${where} must be an ISO 8601 date or timestamp, e.g. "2026-07-01" or "2026-07-01T00:00:00Z"`)
    return null
  }

  return parsed.toISOString()
}
