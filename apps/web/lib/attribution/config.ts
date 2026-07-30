import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

import { requireOwnedForm } from '@/lib/auth'
import { getPlatform, markUrl, monogramColor } from '@/lib/catalog/platforms'
import { parseJsonValue, sql, tx } from '@/lib/db'

import { configHash } from './hash'
import { AttributionConfigError, parseAttributionConfig, type AskNode } from './schema'

/**
 * The configure write path: forms, their settings, and their config snapshots.
 *
 * Design contract: docs/design/attribution-pivot.md §4 and §5.5.
 *
 * Everything load-bearing here protects one property: a config version, once minted,
 * describes exactly what a respondent saw. Two consequences that read as fussiness
 * and are not:
 *
 *   - Catalog labels and marks are COPIED into the snapshot, never joined at read
 *     time. A product-side logo swap would otherwise rewrite what last quarter's
 *     rollup claims was rendered (§4).
 *   - An identical reconfigure returns the existing version rather than minting a new
 *     one. §6.2 scopes its position-effect sample to a single config_version and
 *     returns null below an impressions-per-position floor, so a fresh version on
 *     every monthly pass would fragment the sample and switch the correction off —
 *     with no error and no symptom other than a number quietly missing from the
 *     rollup (§5.5).
 */

export type FormSummary = {
  id: string
  name: string
  status: string
  current_version: number | null
  response_count: number
  allowed_origins: string[]
  created_at: string
}

export type FormConfigSnapshot = {
  version: number
  nodes: AskNode[]
  root_node_id: string
  config_hash: string
  created_at: string
}

export type FormDetail = {
  id: string
  name: string
  status: string
  current_version: number | null
  allowed_origins: string[]
  theme: Record<string, unknown>
  per_response_webhook_url: string | null
  response_count: number
  created_at: string
  config: FormConfigSnapshot | null
}

/**
 * Raised where `requireOwnedForm` would have returned null. It keeps that helper's
 * conflation of "does not exist" with "is not yours" — telling those apart would let
 * anyone walk the id space and learn which forms are real.
 */
export class FormNotFoundError extends Error {
  constructor() {
    super('Form not found')
    this.name = 'FormNotFoundError'
  }
}

/** Mirrors {@link AttributionConfigError}: every problem at once, not just the first. */
export class FormSettingsError extends Error {
  errors: string[]

  constructor(errors: string[]) {
    super('Invalid form settings')
    this.name = 'FormSettingsError'
    this.errors = errors
  }
}

const MAX_NAME = 120
const MAX_ORIGINS = 20
const MAX_WEBHOOK_URL = 2048
const MAX_RADIUS = 48

export async function createForm(
  accountId: string,
  input: unknown,
): Promise<{ id: string; warnings: string[] }> {
  const { settings, warnings } = parseFormSettings(input, { create: true })
  const id = nanoid(12)

  await sql`
    INSERT INTO attribution_forms (
      id, account_id, name, allowed_origins, theme, per_response_webhook_url
    )
    VALUES (
      ${id},
      ${accountId},
      ${settings.name as string},
      ${settings.allowed_origins ?? []}::text[],
      ${JSON.stringify(settings.theme ?? {})}::jsonb,
      ${settings.per_response_webhook_url ?? null}
    )
  `

  return { id, warnings }
}

/**
 * Settings only — name, status, origins, theme, webhook. Never the config.
 *
 * Kept apart from {@link configureForm} because the two have opposite mutability
 * rules: settings are live properties of the placement and are meant to be edited,
 * while a config is an immutable snapshot that history is joined against. Folding a
 * candidate edit into a PATCH would let a caller change what a stored response says
 * it rendered.
 */
export async function updateForm(
  accountId: string,
  formId: string,
  input: unknown,
): Promise<{ form: FormSummary; warnings: string[] }> {
  const { settings, warnings } = parseFormSettings(input, { create: false })

  if (Object.keys(settings).length === 0) {
    throw new FormSettingsError([
      'no updatable fields present; expected one of name, status, allowed_origins, theme, per_response_webhook_url',
    ])
  }

  // COALESCE covers every field whose null is meaningless, which is all of them except
  // the webhook: there, null is the caller clearing the destination, so "omitted" and
  // "explicitly null" have to stay distinguishable and a CASE is the only way to say so
  // in one statement.
  const rows = (await sql`
    UPDATE attribution_forms
    SET
      name = COALESCE(${settings.name ?? null}, name),
      status = COALESCE(${settings.status ?? null}, status),
      allowed_origins = COALESCE(${settings.allowed_origins ?? null}::text[], allowed_origins),
      theme = COALESCE(${settings.theme ? JSON.stringify(settings.theme) : null}::jsonb, theme),
      per_response_webhook_url = CASE
        WHEN ${'per_response_webhook_url' in settings}
          THEN ${settings.per_response_webhook_url ?? null}
        ELSE per_response_webhook_url
      END
    WHERE id = ${formId} AND account_id = ${accountId}
    RETURNING id, name, status, current_version, response_count, allowed_origins, created_at
  `) as FormSummary[]

  if (!rows[0]) {
    throw new FormNotFoundError()
  }

  return { form: rows[0], warnings }
}

/**
 * Validate a config, snapshot it, and point the form at it. §5.5.
 *
 * Returns `created: false` when the content hash matched an existing version. Note
 * that `current_version` still moves in that case: re-posting a config the form used
 * two versions ago is a request for that config to be live again, and only the
 * *minting* was skipped.
 */
export async function configureForm(
  accountId: string,
  formId: string,
  rawConfig: unknown,
): Promise<{ version: number; created: boolean; warnings: string[] }> {
  const form = await requireOwnedForm(accountId, formId)

  if (!form) {
    throw new FormNotFoundError()
  }

  const { input, errors } = hydrateFromCatalog(rawConfig)

  let config

  try {
    config = parseAttributionConfig(input)
  } catch (error) {
    // Catalog errors would otherwise be swallowed whenever the config also has a
    // structural problem, and the caller would fix the second one only to be told
    // about the first on the next round trip.
    if (errors.length > 0 && error instanceof AttributionConfigError) {
      throw new AttributionConfigError([...errors, ...error.errors])
    }

    throw error
  }

  if (errors.length > 0) {
    throw new AttributionConfigError(errors)
  }

  // Hashing the hydrated config, not the caller's input, is deliberate: the hash has to
  // describe what will be rendered. A catalog label or mark changing in a future deploy
  // therefore mints a new version on the next configure, which looks like a dedupe bug
  // and is the correct answer — the snapshot genuinely differs from its predecessor.
  const hash = configHash(config)

  const results = (await tx([
    // Serialize configures per form. Both statements below read MAX(version) from the
    // same snapshot otherwise, so two concurrent calls compute the same next version
    // and one dies on the (form_id, version) primary key. The deferred FK on
    // current_version catches a torn write; it is not the concurrency story.
    //
    // This takes the same form-row lock that stamp_response_completion() takes, so a
    // configure briefly blocks completions for that form. That serialization already
    // exists for the cursor ordering guarantee and costs nothing new here.
    sql`SELECT id FROM attribution_forms WHERE id = ${formId} FOR UPDATE`,

    // ON CONFLICT rather than a pre-flight SELECT for the hash: the pre-flight would be
    // its own round trip outside this transaction, so an identical concurrent configure
    // could still slip past it and fail on the unique index. DO NOTHING turns that race
    // into the dedupe it was always meant to be.
    sql`
      INSERT INTO attribution_configs (form_id, version, nodes, root_node_id, config_hash)
      SELECT
        ${formId},
        COALESCE(MAX(version), 0) + 1,
        ${JSON.stringify(config.nodes)}::jsonb,
        ${config.root_node_id},
        ${hash}
      FROM attribution_configs
      WHERE form_id = ${formId}
      ON CONFLICT (form_id, config_hash) DO NOTHING
      RETURNING version
    `,

    sql`
      UPDATE attribution_forms
      SET current_version = (
        SELECT version
        FROM attribution_configs
        WHERE form_id = ${formId} AND config_hash = ${hash}
      )
      WHERE id = ${formId}
      RETURNING current_version
    `,
  ])) as unknown as [
    unknown[],
    Array<{ version: number }>,
    Array<{ current_version: number | null }>,
  ]

  const version = results[2][0]?.current_version

  if (version === null || version === undefined) {
    // Only reachable if the form was deleted between the ownership check and the
    // transaction; the FK on attribution_configs.form_id normally raises first.
    throw new FormNotFoundError()
  }

  return { version, created: results[1].length > 0, warnings: originWarnings(form.allowed_origins) }
}

/** The form plus the snapshot it currently points at. Null when not found or not owned. */
export async function getForm(accountId: string, formId: string): Promise<FormDetail | null> {
  // Scoping by account_id in the WHERE clause is the ownership check, not a filter
  // applied after one: a lookup by id alone here would be an authorization bug that
  // reads like ordinary code.
  const rows = (await sql`
    SELECT
      f.id,
      f.name,
      f.status,
      f.current_version,
      f.allowed_origins,
      f.theme,
      f.per_response_webhook_url,
      f.response_count,
      f.created_at,
      c.nodes,
      c.root_node_id,
      c.config_hash,
      c.created_at AS config_created_at
    FROM attribution_forms f
    LEFT JOIN attribution_configs c
      ON c.form_id = f.id AND c.version = f.current_version
    WHERE f.id = ${formId} AND f.account_id = ${accountId}
    LIMIT 1
  `) as Array<{
    id: string
    name: string
    status: string
    current_version: number | null
    allowed_origins: string[]
    theme: unknown
    per_response_webhook_url: string | null
    response_count: number
    created_at: string
    nodes: unknown
    root_node_id: string | null
    config_hash: string | null
    config_created_at: string | null
  }>

  const row = rows[0]

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    current_version: row.current_version,
    allowed_origins: row.allowed_origins,
    theme: parseJsonValue<Record<string, unknown>>(row.theme) ?? {},
    per_response_webhook_url: row.per_response_webhook_url,
    response_count: row.response_count,
    created_at: row.created_at,
    config:
      row.current_version === null || row.root_node_id === null
        ? null
        : {
            version: row.current_version,
            nodes: parseJsonValue<AskNode[]>(row.nodes),
            root_node_id: row.root_node_id,
            config_hash: row.config_hash as string,
            created_at: row.config_created_at as string,
          },
  }
}

/**
 * §10.4 lists this as a read tool for a reason worth restating: an agent cannot
 * configure a form whose id it cannot find, and after the pivot the id is not written
 * down anywhere a later session can reach.
 */
export async function listForms(accountId: string): Promise<FormSummary[]> {
  return (await sql`
    SELECT id, name, status, current_version, response_count, allowed_origins, created_at
    FROM attribution_forms
    WHERE account_id = ${accountId}
    ORDER BY created_at DESC
  `) as FormSummary[]
}

/**
 * Map the errors this module throws onto responses, so all four routes answer a bad
 * config identically. Returns null for anything unrecognized, which the caller must
 * treat as a 500 — swallowing an unknown error here would report a database outage as
 * a validation failure.
 */
export function configErrorResponse(error: unknown): Response | null {
  if (error instanceof AttributionConfigError) {
    return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 })
  }

  if (error instanceof FormSettingsError) {
    return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 })
  }

  if (error instanceof FormNotFoundError) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  return null
}

// --- settings ---------------------------------------------------------------

type FormSettings = {
  name?: string
  status?: 'active' | 'paused'
  allowed_origins?: string[]
  theme?: Record<string, unknown>
  per_response_webhook_url?: string | null
}

/**
 * Only keys the caller actually sent land in the result, so `updateForm` can tell an
 * omitted field from one explicitly set to null.
 */
function parseFormSettings(
  input: unknown,
  options: { create: boolean },
): { settings: FormSettings; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const settings: FormSettings = {}

  if (input === undefined || input === null) {
    if (options.create) {
      throw new FormSettingsError(['name is required'])
    }

    throw new FormSettingsError(['request body is required'])
  }

  if (!isRecord(input)) {
    throw new FormSettingsError(['request body must be an object'])
  }

  if (options.create || input.name !== undefined) {
    const name = readText(input.name, 'name', MAX_NAME, errors)

    if (name) {
      settings.name = name
    } else if (input.name === undefined) {
      errors.push('name is required')
    }
  }

  if (input.status !== undefined) {
    if (input.status !== 'active' && input.status !== 'paused') {
      // The lifecycle collapsed to two states with the pivot (§2): an attribution form
      // is a perpetual stream, so there is nothing for open/closed/expired/full to mean.
      errors.push('status must be "active" or "paused"')
    } else {
      settings.status = input.status
    }
  }

  if (options.create || input.allowed_origins !== undefined) {
    const origins = readOrigins(input.allowed_origins, errors)
    settings.allowed_origins = origins
    warnings.push(...originWarnings(origins))
  }

  if (input.theme !== undefined) {
    // Replaces the stored theme wholesale rather than merging into it. Merging would
    // leave a token with no way to be removed — the caller would send `accent` once and
    // be stuck with it — so `{}` is how you reset, and a partial theme is a partial
    // theme.
    settings.theme = readTheme(input.theme, errors)
  }

  if (input.per_response_webhook_url !== undefined) {
    settings.per_response_webhook_url = readWebhookUrl(input.per_response_webhook_url, errors)
  }

  if (errors.length > 0) {
    throw new FormSettingsError(errors)
  }

  return { settings, warnings }
}

/**
 * An empty allowlist is enforced as allow-all so a form is usable before the host
 * knows its own origins, which under per-response pricing means any site can embed it
 * and spend the account's quota (§10.3). That is a billing fact, not a security
 * preference, so it is surfaced on every write rather than left to the docs.
 */
function originWarnings(origins: string[]): string[] {
  if (origins.length > 0) {
    return []
  }

  return [
    'allowed_origins is empty, which is enforced as allow-all: any site can embed this form and spend your response quota',
  ]
}

function readOrigins(value: unknown, errors: string[]): string[] {
  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    errors.push('allowed_origins must be an array of origins')
    return []
  }

  if (value.length > MAX_ORIGINS) {
    errors.push(`allowed_origins must contain at most ${MAX_ORIGINS} entries`)
    return []
  }

  const origins: string[] = []

  value.forEach((entry, index) => {
    const where = `allowed_origins[${index}]`

    if (typeof entry !== 'string') {
      errors.push(`${where} must be a string`)
      return
    }

    const raw = entry.trim()
    let url: URL

    try {
      url = new URL(raw)
    } catch {
      errors.push(`${where} must be an absolute origin, e.g. "https://app.example.com"`)
      return
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      errors.push(`${where} must use http or https`)
      return
    }

    // A path here means the caller is thinking in URLs. The value is compared against a
    // browser's Origin header, which never carries one, so accepting it would silently
    // match nothing — reject it rather than normalize it away, so the mismatch is
    // discovered at configure time instead of as an empty rollup.
    if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
      errors.push(`${where} must be an origin only, with no path, query or fragment`)
      return
    }

    if (!origins.includes(url.origin)) {
      origins.push(url.origin)
    }
  })

  return origins
}

const THEME_TOKENS = new Set(['accent', 'radius', 'font', 'dark_mode'])

/**
 * The bounded token set from §3.9. Unknown keys are an error rather than dropped: a
 * theme that silently ignores `accent_color` is indistinguishable from a theme that
 * did not apply, and the caller has no way to tell which.
 */
function readTheme(value: unknown, errors: string[]): Record<string, unknown> {
  if (!isRecord(value)) {
    errors.push('theme must be an object')
    return {}
  }

  const theme: Record<string, unknown> = {}

  for (const key of Object.keys(value)) {
    if (!THEME_TOKENS.has(key)) {
      errors.push(`theme.${key} is not a theme token; expected ${[...THEME_TOKENS].join(', ')}`)
    }
  }

  if (value.accent !== undefined) {
    if (typeof value.accent !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.accent.trim())) {
      errors.push('theme.accent must be a hex color, e.g. "#4F46E5"')
    } else {
      theme.accent = value.accent.trim().toLowerCase()
    }
  }

  if (value.radius !== undefined) {
    if (!Number.isInteger(value.radius) || (value.radius as number) < 0 || (value.radius as number) > MAX_RADIUS) {
      errors.push(`theme.radius must be an integer between 0 and ${MAX_RADIUS} (px)`)
    } else {
      theme.radius = value.radius
    }
  }

  if (value.font !== undefined) {
    // A CSS font-family list, and nothing that can leave one. These tokens end up
    // inside a stylesheet in an iframe the host does not control, where a single `;`
    // closes the declaration and turns the rest of the string into attacker-authored
    // CSS running in front of a respondent.
    if (typeof value.font !== 'string' || !/^[A-Za-z0-9 ,'"()_-]{1,120}$/.test(value.font.trim())) {
      errors.push('theme.font must be a font-family list of letters, digits, spaces, commas and quotes')
    } else {
      theme.font = value.font.trim()
    }
  }

  if (value.dark_mode !== undefined) {
    if (value.dark_mode !== 'light' && value.dark_mode !== 'dark' && value.dark_mode !== 'auto') {
      errors.push('theme.dark_mode must be "light", "dark" or "auto"')
    } else {
      theme.dark_mode = value.dark_mode
    }
  }

  return theme
}

function readWebhookUrl(value: unknown, errors: string[]): string | null {
  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    errors.push('per_response_webhook_url must be a string or null')
    return null
  }

  const raw = value.trim()

  if (raw.length === 0) {
    return null
  }

  if (raw.length > MAX_WEBHOOK_URL) {
    errors.push(`per_response_webhook_url must be at most ${MAX_WEBHOOK_URL} characters`)
    return null
  }

  try {
    const url = new URL(raw)

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      errors.push('per_response_webhook_url must be an http or https URL')
      return null
    }
  } catch {
    errors.push('per_response_webhook_url must be a valid URL')
    return null
  }

  return raw
}

function readText(value: unknown, where: string, max: number, errors: string[]): string | null {
  if (value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    errors.push(`${where} must be a string`)
    return null
  }

  const text = value.trim()

  if (text.length === 0) {
    errors.push(`${where} must not be empty`)
    return null
  }

  if (text.length > max) {
    errors.push(`${where} must be at most ${max} characters`)
    return null
  }

  return text
}

// --- catalog hydration ------------------------------------------------------

/**
 * Copy label, mark and aliases out of the platform catalog into any candidate that
 * names a `catalog_slug` (§4).
 *
 * This runs BEFORE the validator, which looks like it inverts §5.1's "validate before
 * you build". It does not. Hydration only fills fields the caller left absent — ids,
 * uniqueness and the expansion graph are untouched, so nothing structurally invalid
 * can become valid here. Running it afterwards would make the copy pointless: the
 * validator requires `label`, so every caller would have had to type the brand name
 * the catalog exists to supply.
 *
 * Correspondingly it must be total. It is handed unvalidated input and returns
 * whatever it cannot recognize unchanged, leaving the validator to describe the
 * problem in its own vocabulary.
 *
 * `expandsByDefault` is deliberately not applied. It is advisory (§10.4 has an agent
 * tune expansion against spend monthly), and materializing it would invent graph edges
 * pointing at nodes the caller never wrote.
 */
function hydrateFromCatalog(raw: unknown): { input: unknown; errors: string[] } {
  const errors: string[] = []

  if (!isRecord(raw) || !Array.isArray(raw.nodes)) {
    return { input: raw, errors }
  }

  const nodes = raw.nodes.map((node, nodeIndex) => {
    if (!isRecord(node) || !Array.isArray(node.candidates)) {
      return node
    }

    const candidates = node.candidates.map((candidate, index) => {
      if (!isRecord(candidate) || typeof candidate.catalog_slug !== 'string') {
        return candidate
      }

      const slug = candidate.catalog_slug.trim()
      const platform = getPlatform(slug)

      if (!platform) {
        // Silently ignoring an unknown slug means the label and mark never appear and
        // the caller has no way to find out why. Paths match the validator's so a
        // caller reading a merged error list never has to reconcile two schemes.
        errors.push(
          `nodes[${nodeIndex}].candidates[${index}].catalog_slug "${slug}" is not in the platform catalog`,
        )
        return candidate
      }

      return {
        ...candidate,
        catalog_slug: slug,
        label: preferCaller(candidate.label, platform.label),
        icon_url: preferCaller(candidate.icon_url, markUrl(platform)),
        // Null for descriptive entries ("A friend or colleague told me"), which is how
        // the renderer knows to draw no tile for them. Copied in rather than looked up
        // live for the same reason label and icon are: a palette change must not be able
        // to repaint what an old render looked like.
        monogram_color: preferCaller(candidate.monogram_color, monogramColor(platform)),
        aliases: mergeAliases(candidate.aliases, platform.aliases),
      }
    })

    return { ...node, candidates }
  })

  return { input: { ...raw, nodes }, errors }
}

/**
 * The caller's value wins (§4), but only when it is a value: a blank string is how an
 * agent spells "use the default", and forwarding it would trip the validator's "must
 * not be empty" instead of falling back to the catalog. Anything that is neither a
 * string nor absent passes straight through, so the validator reports the real
 * problem rather than having it papered over.
 */
function preferCaller(supplied: unknown, fromCatalog: string | null): unknown {
  if (supplied === undefined || supplied === null) {
    return fromCatalog ?? undefined
  }

  if (typeof supplied === 'string' && supplied.trim().length === 0) {
    return fromCatalog ?? undefined
  }

  return supplied
}

/**
 * Aliases merge rather than override, unlike label and icon. They are matched and
 * never displayed (§3.4), so there is no conflict for the caller to win: dropping the
 * catalog's on the first caller-supplied alias would mean a form that adds "the bird
 * app" stops matching "twitter". The validator lowercases and dedupes.
 */
function mergeAliases(fromCaller: unknown, fromCatalog: readonly string[] | undefined): unknown {
  if (!fromCatalog || fromCatalog.length === 0) {
    return fromCaller
  }

  if (fromCaller === undefined || fromCaller === null) {
    return [...fromCatalog]
  }

  if (!Array.isArray(fromCaller)) {
    return fromCaller
  }

  return [...fromCaller, ...fromCatalog]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
