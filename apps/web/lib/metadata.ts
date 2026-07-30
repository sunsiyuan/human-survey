// Response tagging: custom URL query params on the respondent page are captured as
// per-response metadata so a host can segment responses by source. See the Embed
// section of /docs.

// Query params the respondent page (/s/[id]) consumes for its own behavior. These are
// never captured as response metadata. Keep in sync with any new param the route
// reads off the URL.
/**
 * Params the embed page consumes for its own behaviour, and which must therefore never
 * be captured as respondent metadata.
 *
 * Adding a param to the page without adding it here is a silent bug: it lands in
 * `attribution_responses.metadata` as a tag, so the host's own plumbing shows up in
 * their segmentation as if a respondent had arrived carrying it.
 */
export const RESERVED_QUERY_PARAMS = ['embed', 'external_id', 'host_origin'] as const

const reserved = new Set<string>(RESERVED_QUERY_PARAMS)

// Caps applied to untrusted metadata before it is persisted. The POST responses
// endpoint is public, so these bound how much a respondent can write.
const MAX_KEYS = 20
const MAX_KEY_LENGTH = 64
const MAX_VALUE_LENGTH = 512

type SearchParamValue = string | string[] | undefined

/**
 * Extracts custom (non-reserved) query params from the respondent URL as a flat
 * string map — the host-facing "response tagging" input. Repeated params keep
 * their last value. The result is already sanitized.
 */
export function extractTagsFromSearchParams(
  searchParams: Record<string, SearchParamValue>,
): Record<string, string> {
  const raw: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(searchParams)) {
    raw[key] = Array.isArray(value) ? value[value.length - 1] : value
  }
  return sanitizeMetadata(raw)
}

/**
 * Clamps untrusted metadata to a safe, predictable shape before it is persisted:
 * string keys and values only, reserved params dropped, key count and string
 * lengths capped. Runs on every response insert.
 */
export function sanitizeMetadata(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }

  const result: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(result).length >= MAX_KEYS) break

    const key = rawKey.trim().slice(0, MAX_KEY_LENGTH)
    if (key.length === 0 || reserved.has(key)) continue

    // Accept strings and numbers; numbers come from query params coerced upstream
    // or from a JSON body. Everything else (objects, booleans, null) is dropped.
    if (typeof rawValue !== 'string' && typeof rawValue !== 'number') continue

    result[key] = String(rawValue).slice(0, MAX_VALUE_LENGTH)
  }
  return result
}
