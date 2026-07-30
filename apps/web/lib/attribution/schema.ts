/**
 * Attribution form config: types, validation, normalization.
 *
 * Design contract: docs/design/attribution-pivot.md §5.1–5.2.
 *
 * This module's job is the inverse of the survey normalizer it replaces. That one
 * MINTED ids — positional, renumbered on every edit. This one VALIDATES ids the caller
 * supplies, because a candidate id has to survive a creator renaming their handle; an
 * id we assign would split that creator's history in half the day they rename (§5.1).
 *
 * It also validates BEFORE it builds. The old normalizer did the reverse and called
 * `.trim()` on a possibly-undefined title before its own validator could run, so the
 * structured-error path was unreachable for the most common malformed input and the
 * caller got a bare TypeError degraded into a 400.
 */

export type CandidateInput = {
  id?: unknown
  label?: unknown
  handle?: unknown
  icon_url?: unknown
  aliases?: unknown
  monogram_color?: unknown
  pinned?: unknown
  dont_remember?: unknown
  expands?: unknown
  catalog_slug?: unknown
}

export type AskNodeInput = {
  id?: unknown
  prompt?: unknown
  candidates?: unknown
  allow_free_text?: unknown
  order?: unknown
}

export type AttributionConfigInput = {
  nodes?: unknown
  root_node_id?: unknown
}

export type Candidate = {
  id: string
  label: string
  handle?: string
  icon_url?: string
  aliases?: string[]
  /**
   * Brand color for the monogram tile shown when no mark or avatar is available.
   *
   * Its PRESENCE is also the signal that a tile should be drawn at all. A tile earns
   * its place when the thing has an identity to recognize — a brand whose mark we
   * cannot ship (ChatGPT, LinkedIn), or a person. It is noise on a descriptive option
   * like "A friend or colleague told me", where a two-letter badge competes for
   * attention with the real logos beside it and inverts §3.2's whole point.
   *
   * Copied into the config snapshot at configure time, like label and icon_url, so a
   * palette change in the catalog cannot repaint an old render.
   */
  monogram_color?: string
  /** Layout only: excluded from ordering, rendered last. */
  pinned?: 'end'
  /**
   * Semantics: this option means "I have no answer", and a response choosing it is
   * recorded as `dont_remember` rather than as a channel.
   *
   * Separate from `pinned` on purpose. Pinning describes where a row sits; this
   * describes what picking it means, and inferring one from the other records real
   * channels as non-answers — a bucket the rollup reports as unresolved, so the
   * channel simply vanishes from the numbers with nothing to notice.
   */
  dont_remember?: true
  expands?: string
  catalog_slug?: string
}

export type AskNode = {
  id: string
  prompt: string
  candidates: Candidate[]
  allow_free_text: boolean
  order: 'fixed' | 'rotate'
}

export type AttributionConfig = {
  nodes: AskNode[]
  root_node_id: string
}

export class AttributionConfigError extends Error {
  errors: string[]

  constructor(errors: string[]) {
    super('Invalid attribution config')
    this.name = 'AttributionConfigError'
    this.errors = errors
  }
}

const ORDERS = new Set(['fixed', 'rotate'])

const MAX_NODES = 12
const MAX_CANDIDATES_PER_NODE = 500
const MAX_ALIASES = 24
const MAX_LABEL = 120
const MAX_ID = 128

/**
 * Validate and normalize. Throws `AttributionConfigError` with every problem found,
 * not just the first — a caller fixing a config one error per round trip is a caller
 * whose agent burns a turn per typo.
 */
export function parseAttributionConfig(input: unknown): AttributionConfig {
  const errors: string[] = []

  if (!isRecord(input)) {
    throw new AttributionConfigError(['config must be an object'])
  }

  const rawNodes = (input as AttributionConfigInput).nodes

  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    throw new AttributionConfigError(['nodes must be a non-empty array'])
  }

  if (rawNodes.length > MAX_NODES) {
    throw new AttributionConfigError([`nodes must contain at most ${MAX_NODES} entries`])
  }

  const nodes: AskNode[] = []
  const seenNodeIds = new Set<string>()

  rawNodes.forEach((rawNode, index) => {
    const where = `nodes[${index}]`

    if (!isRecord(rawNode)) {
      errors.push(`${where} must be an object`)
      return
    }

    const node = rawNode as AskNodeInput
    const id = readId(node.id, `${where}.id`, errors)
    const prompt = readText(node.prompt, `${where}.prompt`, errors, { required: true })

    if (id) {
      if (seenNodeIds.has(id)) {
        errors.push(`${where}.id "${id}" is not unique`)
      }
      seenNodeIds.add(id)
    }

    let order: 'fixed' | 'rotate' = 'rotate'

    if (node.order !== undefined) {
      if (typeof node.order !== 'string' || !ORDERS.has(node.order)) {
        errors.push(`${where}.order must be "fixed" or "rotate"`)
      } else {
        order = node.order as 'fixed' | 'rotate'
      }
    }

    let allowFreeText = true

    if (node.allow_free_text !== undefined) {
      if (typeof node.allow_free_text !== 'boolean') {
        errors.push(`${where}.allow_free_text must be a boolean`)
      } else {
        allowFreeText = node.allow_free_text
      }
    }

    const candidates = readCandidates(node.candidates, where, errors)

    if (id && prompt) {
      nodes.push({ id, prompt, candidates, allow_free_text: allowFreeText, order })
    }
  })

  // Structural checks only make sense once every node parsed; running them against a
  // partially-built graph produces cascading nonsense on top of the real error.
  if (errors.length === 0) {
    errors.push(...validateGraph(nodes, (input as AttributionConfigInput).root_node_id))
  }

  if (errors.length > 0) {
    throw new AttributionConfigError(errors)
  }

  return { nodes, root_node_id: resolveRoot(nodes) }
}

function readCandidates(raw: unknown, where: string, errors: string[]): Candidate[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push(`${where}.candidates must be a non-empty array`)
    return []
  }

  if (raw.length > MAX_CANDIDATES_PER_NODE) {
    errors.push(`${where}.candidates must contain at most ${MAX_CANDIDATES_PER_NODE} entries`)
    return []
  }

  const candidates: Candidate[] = []
  const seen = new Set<string>()
  let pinnedCount = 0
  let dontRememberCount = 0

  raw.forEach((rawCandidate, index) => {
    const at = `${where}.candidates[${index}]`

    if (!isRecord(rawCandidate)) {
      errors.push(`${at} must be an object`)
      return
    }

    const input = rawCandidate as CandidateInput
    const id = readId(input.id, `${at}.id`, errors)
    const label = readText(input.label, `${at}.label`, errors, { required: true })

    if (id) {
      if (seen.has(id)) {
        errors.push(`${at}.id "${id}" is not unique within the node`)
      }
      seen.add(id)
    }

    let pinned: 'end' | undefined

    if (input.pinned !== undefined) {
      if (input.pinned !== 'end') {
        errors.push(`${at}.pinned must be "end" when present`)
      } else {
        pinned = 'end'
        pinnedCount += 1
      }
    }

    let dontRemember: true | undefined

    if (input.dont_remember !== undefined) {
      if (input.dont_remember !== true) {
        errors.push(`${at}.dont_remember must be true when present`)
      } else {
        dontRemember = true
        dontRememberCount += 1

        // An escape hatch that can scroll away, or that rotation can bury in the
        // middle of a list, is not one. §3.5's whole argument is that it has to be
        // visible at the moment a respondent fails to find their answer.
        if (pinned !== 'end') {
          errors.push(`${at}.dont_remember requires pinned: "end"`)
        }
      }
    }

    const aliases = readAliases(input.aliases, at, errors)

    if (!id || !label) {
      return
    }

    candidates.push({
      id,
      label,
      handle: readText(input.handle, `${at}.handle`, errors) || undefined,
      icon_url: readText(input.icon_url, `${at}.icon_url`, errors) || undefined,
      aliases: aliases.length > 0 ? aliases : undefined,
      monogram_color: readText(input.monogram_color, `${at}.monogram_color`, errors) || undefined,
      pinned,
      dont_remember: dontRemember,
      expands: readText(input.expands, `${at}.expands`, errors) || undefined,
      catalog_slug: readText(input.catalog_slug, `${at}.catalog_slug`, errors) || undefined,
    })
  })

  // §3.5: the escape hatch is pinned last and never sorted. More than one pinned entry
  // makes "last" ambiguous, and the ordering code would have to invent a tiebreak that
  // the position-effect model then has to know about.
  if (pinnedCount > 1) {
    errors.push(`${where}.candidates has ${pinnedCount} pinned entries; at most one is allowed`)
  }

  if (dontRememberCount > 1) {
    errors.push(
      `${where}.candidates has ${dontRememberCount} dont_remember entries; at most one is allowed`,
    )
  }

  return candidates
}

function validateGraph(nodes: AskNode[], declaredRoot: unknown): string[] {
  const errors: string[] = []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const incoming = new Map<string, string[]>()

  for (const node of nodes) {
    for (const candidate of node.candidates) {
      if (!candidate.expands) {
        continue
      }

      if (!byId.has(candidate.expands)) {
        errors.push(
          `node "${node.id}" candidate "${candidate.id}" expands to unknown node "${candidate.expands}"`,
        )
        continue
      }

      if (candidate.expands === node.id) {
        errors.push(`node "${node.id}" candidate "${candidate.id}" expands to its own node`)
        continue
      }

      incoming.set(candidate.expands, [...(incoming.get(candidate.expands) ?? []), node.id])
    }
  }

  if (errors.length > 0) {
    return errors
  }

  const roots = nodes.filter((node) => !incoming.has(node.id))

  if (roots.length === 0) {
    // Every node is expanded from somewhere, which means the graph is one big cycle
    // and there is no question to ask first.
    errors.push('no root node: every node is reachable from another, so the form has no entry point')
    return errors
  }

  if (roots.length > 1) {
    errors.push(
      `expected exactly one root node, found ${roots.length}: ${roots.map((n) => `"${n.id}"`).join(', ')}`,
    )
  }

  if (declaredRoot !== undefined) {
    if (typeof declaredRoot !== 'string') {
      errors.push('root_node_id must be a string when present')
    } else if (!byId.has(declaredRoot)) {
      errors.push(`root_node_id "${declaredRoot}" is not a known node`)
    } else if (roots.length === 1 && roots[0].id !== declaredRoot) {
      errors.push(
        `root_node_id "${declaredRoot}" is expanded from another node; the root is "${roots[0].id}"`,
      )
    }
  }

  if (roots.length !== 1) {
    return errors
  }

  // A cycle further down would let a respondent loop forever. Roots having no incoming
  // edge does not rule this out — a disjoint cycle elsewhere has no incoming edge from
  // the root's component either, and would show up below as unreachable rather than as
  // a cycle, so check both.
  const cycle = findCycle(nodes, byId)

  if (cycle) {
    errors.push(`expansion cycle: ${cycle.join(' → ')}`)
  }

  const reachable = new Set<string>()
  const queue = [roots[0].id]

  while (queue.length > 0) {
    const id = queue.shift() as string

    if (reachable.has(id)) {
      continue
    }

    reachable.add(id)

    for (const candidate of byId.get(id)?.candidates ?? []) {
      if (candidate.expands) {
        queue.push(candidate.expands)
      }
    }
  }

  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      // Silently keeping it would mean storing a node in the immutable snapshot that
      // no respondent can ever see, which then shows up in rollups as a question with
      // zero answers and no explanation.
      errors.push(`node "${node.id}" is unreachable from the root`)
    }
  }

  return errors
}

function findCycle(nodes: AskNode[], byId: Map<string, AskNode>): string[] | null {
  const WHITE = 0
  const GREY = 1
  const BLACK = 2
  const color = new Map<string, number>(nodes.map((node) => [node.id, WHITE]))
  const stack: string[] = []

  function visit(id: string): string[] | null {
    color.set(id, GREY)
    stack.push(id)

    for (const candidate of byId.get(id)?.candidates ?? []) {
      const next = candidate.expands

      if (!next) {
        continue
      }

      if (color.get(next) === GREY) {
        return [...stack.slice(stack.indexOf(next)), next]
      }

      if (color.get(next) === WHITE) {
        const found = visit(next)

        if (found) {
          return found
        }
      }
    }

    stack.pop()
    color.set(id, BLACK)
    return null
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      const found = visit(node.id)

      if (found) {
        return found
      }
    }
  }

  return null
}

function resolveRoot(nodes: AskNode[]): string {
  const expanded = new Set(
    nodes.flatMap((node) => node.candidates.map((c) => c.expands).filter(Boolean) as string[]),
  )

  return (nodes.find((node) => !expanded.has(node.id)) as AskNode).id
}

// --- primitives -------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readId(value: unknown, where: string, errors: string[]): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${where} is required and must be a non-empty string`)
    return null
  }

  const id = value.trim()

  if (id.length > MAX_ID) {
    errors.push(`${where} must be at most ${MAX_ID} characters`)
    return null
  }

  return id
}

function readText(
  value: unknown,
  where: string,
  errors: string[],
  options: { required?: boolean } = {},
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

  if (text.length > MAX_LABEL) {
    errors.push(`${where} must be at most ${MAX_LABEL} characters`)
    return null
  }

  return text
}

function readAliases(value: unknown, where: string, errors: string[]): string[] {
  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    errors.push(`${where}.aliases must be an array of strings`)
    return []
  }

  if (value.length > MAX_ALIASES) {
    errors.push(`${where}.aliases must contain at most ${MAX_ALIASES} entries`)
    return []
  }

  const aliases: string[] = []

  for (const entry of value) {
    if (typeof entry !== 'string') {
      errors.push(`${where}.aliases must contain only strings`)
      return []
    }

    const alias = entry.trim().toLowerCase()

    if (alias.length > 0 && !aliases.includes(alias)) {
      aliases.push(alias)
    }
  }

  return aliases
}
