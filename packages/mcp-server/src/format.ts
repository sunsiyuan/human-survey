/**
 * Formatters. These are the product's interface, not a debug view of it.
 *
 * A tool returns text, a model reads that text, and the model then makes a claim to a
 * human. So the format's job is to make the correct claim easy to write and the incorrect
 * one hard — which is a different job from showing the data.
 *
 * The load-bearing rule here is that a share is never printed on its own. Every one is
 * written "3 of 8 — 38%", because the base differs per question and because a reader who
 * has to guess whether 38% excludes the don't-knows will guess wrong. The API ships
 * `denominator` as a field for exactly this reason, and a formatter that prints a bare
 * percentage throws that away: a model shown "38%" will quote "38%".
 *
 * The second rule is that a number the API deliberately did not compute must say so.
 * `share_corrected` is null in v1; omitting the row would let a model infer the correction
 * was applied and the answer was zero.
 *
 * The third rule is that the caveats are the API's, not ours. Every read ships a `notes`
 * array — the honesty layer, one entry per number that can be misread — and these formatters
 * render it verbatim rather than paraphrasing it. An earlier revision dropped `notes`
 * entirely and hand-wrote two of the caveats here instead, which is the same defect this
 * codebase keeps producing: two sources for one fact, drifting apart the first time the
 * server learns a new one. The server is the source; this file is a renderer.
 */

type RollupRow = {
  node_id: string
  candidate_id: string | null
  label: string | null
  label_from_node_id?: string | null
  responses: number
  share: number
  share_corrected: number | null
  revenue_cents: number | null
  paying_responses: number | null
  resolved_by_remap: number
}

type Unresolved = { raw: number; dont_remember: number; skipped: number }

type Followup = {
  node_id: string
  candidate_id: string
  follow_node_id: string
  picks: number
  unresolved?: number
  abandoned?: number
  rate: number
}

export type Rollup = {
  form_id: string
  by: string
  window: { from: string | null; to: string | null; basis: string; bounds?: string }
  denominator: { completed_responses: number; per_node: Record<string, number> }
  rows: RollupRow[]
  unresolved: Unresolved & { per_node: Record<string, Unresolved> }
  followup_unresolved: Followup[]
  followup_abandoned: Followup[]
  revenue: {
    total_cents: number
    paying_responses: number
    event: string
    currencies: string[]
    basis: string
  }
  share_corrected?: null
  position_effect: unknown
  calibration: unknown
  notes?: string[]
}

/**
 * The API's caveats, verbatim and last, so a model that stops reading early has still read
 * the numbers with their qualifiers attached. Never summarized: a note exists because some
 * specific wrong sentence is easy to write without it, and a paraphrase is exactly how that
 * sentence gets written anyway.
 */
function notesBlock(notes: string[] | undefined, heading: string): string[] {
  if (!notes?.length) {
    return []
  }

  return ['', heading, ...notes.map((note) => `  - ${note}`)]
}

/** "3 of 8 — 38%". Never just the percentage. */
function ofBase(count: number, base: number): string {
  if (base === 0) {
    return `${count} of 0`
  }

  return `${count} of ${base} — ${Math.round((count / base) * 100)}%`
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length)
}

function money(cents: number, currencies: string[]): string {
  const amount = (cents / 100).toFixed(2)

  if (currencies.length === 0) {
    return amount
  }

  if (currencies.length === 1) {
    return `${amount} ${currencies[0]}`
  }

  // Mixed currencies were summed as plain integers upstream, so the total is not a real
  // amount. Saying so is the only honest option — a model handed "18400.00" will report a
  // number that adds dollars to euros.
  return `${amount} across MIXED CURRENCIES (${currencies.join(', ')}) — this total is not meaningful`
}

function windowLabel(w: Rollup['window']): string {
  if (!w.from && !w.to) {
    return 'all time'
  }

  return `${w.from ?? 'the beginning'} to ${w.to ?? 'now'} (end exclusive)`
}

export function formatRollup(rollup: Rollup): string {
  const out: string[] = []

  out.push(`Attribution · form ${rollup.form_id} · ${windowLabel(rollup.window)}`)
  out.push(`${rollup.denominator.completed_responses} completed responses in this window.`)

  if (rollup.denominator.completed_responses === 0) {
    out.push('')
    out.push(
      'Nothing to report yet. A response is counted once the respondent finishes, so a form ' +
        'that was embedded recently can be working correctly and still show zero.',
    )
    // The notes matter MORE here than on a populated rollup, not less: the likeliest reason
    // for an empty window is that the window is not the one the caller meant, and the note
    // explaining half-open bounds and how a zoneless timestamp is read is the thing that
    // says so. An early return that skipped them withheld the answer from the only reader
    // who needed it.
    out.push(...notesBlock(rollup.notes, 'WHY THIS MIGHT BE EMPTY — from the API, verbatim:'))
    return out.join('\n')
  }

  const nodes = Object.keys(rollup.denominator.per_node)

  for (const nodeId of nodes) {
    const base = rollup.denominator.per_node[nodeId] ?? 0
    const rows = rollup.rows.filter((row) => row.node_id === nodeId)
    const nodeUnresolved = rollup.unresolved.per_node[nodeId] ?? {
      raw: 0,
      dont_remember: 0,
      skipped: 0,
    }

    out.push('')
    out.push(`QUESTION "${nodeId}" — ${base} of the ${rollup.denominator.completed_responses} answered it`)

    for (const row of rows) {
      // by=node deliberately nulls candidate_id and label: the row IS the node, every
      // resolved candidate rolled into one. Falling through to "(unlabelled)" printed a
      // table of identical "(unlabelled)  N of N — 100%" lines, which reads as a bug in the
      // data rather than as the grouping the caller asked for.
      const name =
        rollup.by === 'node'
          ? 'all resolved answers'
          : (row.label ?? row.candidate_id ?? '(unlabelled)')
      const offNode = row.label_from_node_id ? `  [label borrowed from "${row.label_from_node_id}"]` : ''
      const remapped = row.resolved_by_remap > 0 ? `  [${row.resolved_by_remap} via a mapping you made]` : ''

      out.push(`  ${pad(name, 26)} ${ofBase(row.responses, base)}${remapped}${offNode}`)

      // Only root-node rows carry money; elsewhere these are null, because a response's
      // revenue belongs to the response and repeating it on every node it answered would
      // multiply the window total by the number of questions asked. Printing the row's
      // money matters most when metric:"revenue" is what ordered these rows — sorting by a
      // column the reader cannot see is how a model explains an order by inventing one.
      if (row.revenue_cents !== null && row.paying_responses !== null) {
        out.push(
          `  ${' '.repeat(26)}   revenue ${money(row.revenue_cents, rollup.revenue.currencies)} · ` +
            `paid by ${ofBase(row.paying_responses, row.responses)}`,
        )
      }
    }

    const unresolvedTotal = nodeUnresolved.raw + nodeUnresolved.dont_remember + nodeUnresolved.skipped

    if (unresolvedTotal > 0) {
      const parts = [
        nodeUnresolved.raw > 0 ? `typed something not on the list: ${nodeUnresolved.raw}` : null,
        nodeUnresolved.dont_remember > 0 ? `said they don't remember: ${nodeUnresolved.dont_remember}` : null,
        nodeUnresolved.skipped > 0 ? `skipped: ${nodeUnresolved.skipped}` : null,
      ].filter(Boolean)

      // In the same list as the candidates, not in a footnote. These responses are part of
      // the base, so a report that omits them describes a different denominator than the
      // one the percentages were computed against.
      out.push(`  ${pad('unresolved', 26)} ${ofBase(unresolvedTotal, base)}`)
      out.push(`  ${' '.repeat(26)}   ${parts.join(' · ')}`)
    }
  }

  if (rollup.followup_unresolved.length > 0 || rollup.followup_abandoned.length > 0) {
    out.push('')
    out.push('FOLLOW-UP COVERAGE — whether the second question found an answer')

    // NUL as the separator because ids are caller-supplied and any printable character
    // could appear inside one, which would collide two distinct triples onto one key.
    // Written as an escape, not as the literal byte it was until 2026-08-01: one
    // unprintable byte makes `file`, grep and everything else that sniffs for binary
    // classify this source as data and skip it in silence — and a search that cannot see
    // a file reports it as clean.
    const abandonedBy = new Map(
      rollup.followup_abandoned.map((f) => [`${f.node_id}\u0000${f.candidate_id}\u0000${f.follow_node_id}`, f]),
    )

    for (const f of rollup.followup_unresolved) {
      const key = `${f.node_id}\u0000${f.candidate_id}\u0000${f.follow_node_id}`
      const abandoned = abandonedBy.get(key)

      out.push(
        `  ${pad(`${f.candidate_id} → ${f.follow_node_id}`, 26)} ${f.picks} picks · ` +
          `${ofBase(f.unresolved ?? 0, f.picks)} unresolved · ` +
          `${abandoned?.abandoned ?? 0} never came back`,
      )
    }

    out.push(
      '  A high unresolved rate here usually means the candidate list is missing people, ' +
        'not that respondents were unwilling.',
    )
  }

  out.push('')

  if (rollup.revenue.total_cents > 0 || rollup.revenue.paying_responses > 0) {
    out.push('REVENUE')
    out.push(`  ${money(rollup.revenue.total_cents, rollup.revenue.currencies)} from ${rollup.revenue.paying_responses} paying respondents`)
    out.push(
      '  Counted once per person, on their first response — a retake books no additional ' +
        'revenue. Per-question revenue appears only on the first question’s rows.',
    )
  } else {
    out.push('REVENUE — none recorded in this window.')
    out.push(
      '  Revenue appears here only if conversion events have been posted for these ' +
        'respondents; without them the numbers above are headcount, not money.',
    )
  }

  out.push('')
  out.push('NOT COMPUTED — these are null, not zero: share_corrected, position_effect, calibration.')

  // These two paragraphs used to be written out here by hand — one explaining the nulls, one
  // explaining "n of base". Both are notes the API already ships, so they were a second copy
  // that could drift from the first. The notes block below is now the only copy.
  out.push(...notesBlock(rollup.notes, 'HOW TO READ THESE NUMBERS — from the API, verbatim:'))

  return out.join('\n')
}

export type UnresolvedList = {
  form_id: string
  totals: {
    raw_responses: number
    mapped_responses: number
    unmapped_responses: number
    texts: number
    unmapped_texts: number
  }
  returned: number
  truncated: boolean
  entries: Array<{
    node_id: string
    raw_normalized: string
    occurrences: number
    variants: string[]
    variant_count: number
    first_seen: string
    last_seen: string
    mapped: boolean
    /**
     * The server has always returned this; this type omitted it and the formatter never
     * printed it, which made revoke_remap unreachable — the id it needs is only obtainable
     * here or from the transcript of whichever earlier session created the mapping.
     */
    remap_id: string | null
    mapped_candidate_id: string | null
    mapped_candidate_label: string | null
  }>
  notes?: string[]
}

export function formatUnresolved(list: UnresolvedList): string {
  const out: string[] = []

  out.push(`Free-text answers on form ${list.form_id}`)
  out.push(
    `${list.totals.unmapped_responses} of ${list.totals.raw_responses} free-text responses ` +
      `have no mapping, across ${list.totals.unmapped_texts} distinct texts.`,
  )

  if (list.entries.length === 0) {
    out.push('')
    out.push('Nothing unmapped.')
    out.push(...notesBlock(list.notes, 'FROM THE API, verbatim:'))
    return out.join('\n')
  }

  out.push('')

  for (const entry of list.entries) {
    const seen = entry.first_seen.slice(0, 10)
    const last = entry.last_seen.slice(0, 10)
    const when = seen === last ? seen : `${seen} to ${last}`
    const variants =
      entry.variant_count > 1 ? `  (${entry.variant_count} spellings: ${entry.variants.map((v) => JSON.stringify(v)).join(', ')})` : ''
    // The mapping id travels with the mapping. Without it the only way to revoke a wrong
    // mapping is to still have the transcript of the session that created it.
    const mapped = entry.mapped
      ? `  → already mapped to ${entry.mapped_candidate_label ?? entry.mapped_candidate_id}` +
        (entry.remap_id ? ` [mapping ${entry.remap_id}]` : '')
      : ''

    out.push(
      `  ${pad(`×${entry.occurrences}`, 5)} "${entry.raw_normalized}"   [question "${entry.node_id}"] ${when}${variants}${mapped}`,
    )
  }

  if (list.truncated) {
    out.push('')
    out.push('More exist than are shown here.')
  }

  out.push('')
  out.push(
    'These are the exact words respondents typed. Two texts that look like the same person ' +
      'may not be, and a text that names nobody on the candidate list may name somebody who ' +
      'is not a candidate at all.',
  )

  out.push(...notesBlock(list.notes, 'FROM THE API, verbatim:'))

  return out.join('\n')
}

export function formatCatalog(
  // Shape mirrors what /api/attribution/catalog actually returns. `has_mark` was typed here
  // once and never existed on the wire — a field a formatter believes in but never receives
  // is invisible in TypeScript, because the cast at the call site is a claim, not a check.
  platforms: Array<{ slug: string; label: string; class: string; icon_url?: string | null; aliases?: string[] }>,
  defaults: string[],
): string {
  const out: string[] = []
  const byClass = new Map<string, typeof platforms>()

  for (const platform of platforms) {
    byClass.set(platform.class, [...(byClass.get(platform.class) ?? []), platform])
  }

  out.push(`${platforms.length} platforms in the catalog. Use the slug as catalog_slug on a candidate;`)
  out.push('the label and the logo are copied into the form at configure time.')

  for (const [klass, entries] of byClass) {
    out.push('')
    out.push(`${klass}:`)
    out.push(`  ${entries.map((entry) => entry.slug).join(', ')}`)
  }

  out.push('')
  out.push(`A reasonable starting set for a B2B product: ${defaults.join(', ')}`)
  out.push('')
  out.push(
    'Longer lists work better than short ones. A channel that is missing does not go ' +
      'uncounted — its respondents pick the nearest thing on the list instead, which books ' +
      'a false answer against a channel that did not earn it.',
  )

  return out.join('\n')
}

/**
 * The host-side embed, ready to paste.
 *
 * This exists because the product's whole claim is that the buyer says one sentence and
 * their agent hands back something they can put in their checkout — and for three releases
 * the agent got a bare URL. `?embed=1` appeared nowhere in this package: not in a tool
 * description, not in an output. A model that has never been shown the embed contract
 * hands over the standalone URL, and the buyer either links to a full-page form from their
 * checkout or goes and reads /docs — which is the one thing this interface exists to spare
 * them.
 *
 * Only three of the five message types are here. `mounting` and `loaded` buy a skeleton
 * during the cold load, which is a refinement; `resize` and the submitted/completed split
 * are the two that are broken without. A snippet long enough to skim past teaches nothing.
 *
 * The origin comes off `form_url` rather than being written in. A self-hosted or staging
 * base URL would otherwise emit a listener that discards every message it receives, which
 * fails as a form that never resizes — no error anywhere, and nothing to search for.
 */
export function embedSnippet(formUrl: string): string {
  let origin: string

  try {
    origin = new URL(formUrl).origin
  } catch {
    // Not a URL we can parse, so any origin check written here would be a guess. A wrong
    // check is worse than none: it silently drops every message.
    return ''
  }

  return [
    'TO EMBED IT — `?embed=1` renders the form with no header, no footer and a transparent',
    "background, sized to the host page. Paste this into the signup or payment page, and put",
    "the host's own id for that person in external_id — that is what lets their payment events",
    'join to these answers later.',
    '',
    '  <iframe id="hs-form"',
    `          src="${formUrl}?embed=1&external_id=YOUR_USER_ID"`,
    '          style="width:100%;border:0"></iframe>',
    '  <script>',
    '    window.addEventListener("message", function (e) {',
    `      if (e.origin !== "${origin}") return`,
    '      if (!e.data || e.data.source !== "humansurvey") return',
    '',
    '      if (e.data.type === "resize") {',
    '        document.getElementById("hs-form").style.height = e.data.height + "px"',
    '      }',
    '      if (e.data.type === "submitted") {',
    '        // First answer is durable. NOT the end — the follow-up may still be on screen,',
    '        // so hiding the frame here cuts the respondent off mid-question.',
    '      }',
    '      if (e.data.type === "completed") {',
    '        // Now it is safe to collapse the frame or route the user on.',
    '      }',
    '    })',
    '  </script>',
    '',
    'Without the resize listener the iframe keeps its initial height and the respondent gets',
    'an inner scrollbar over the answer list. Any other query param on the URL is stored as a',
    'tag on the response (?plan=pro), so it can be segmented on later; embed, external_id and',
    `host_origin are reserved. The remaining two message types are at ${origin}/docs#embed.`,
  ].join('\n')
}
