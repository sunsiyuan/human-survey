import { createHash } from 'node:crypto'

import type { AttributionConfig } from './schema'

/**
 * Content hash of a config, used to deduplicate identical reconfigures.
 *
 * `attribution_configs` has UNIQUE (form_id, config_hash) so that an agent re-posting
 * an unchanged config on its monthly pass reuses the existing version instead of
 * minting a new one. That is not tidiness: position-effect estimation is scoped to a
 * single config version and returns null below a minimum impressions-per-position
 * floor, so a new version every month would fragment the sample and switch the
 * correction off — with no error, and no symptom other than a number quietly going
 * missing (docs/design/attribution-pivot.md §5.5, §6.2).
 *
 * Which makes this function's stability a correctness requirement, not a style
 * choice. If canonicalization changes between releases, every existing config stops
 * matching its own hash and every form silently starts versioning on each configure
 * call. Change it only alongside a rehash migration, and keep hash.test.ts honest.
 */
export function configHash(config: AttributionConfig): string {
  return createHash('sha256').update(canonicalize(config)).digest('hex')
}

/**
 * Deterministic JSON: object keys sorted, `undefined` dropped, arrays left in order.
 *
 * Array order is significant and must NOT be sorted — for a `fixed` node the caller's
 * order is the rendered order, so two configs differing only in candidate order are
 * genuinely different configs and must hash differently.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null)
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`)

  return `{${entries.join(',')}}`
}
