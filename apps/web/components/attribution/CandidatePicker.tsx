'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { MAX_VISIBLE } from '@/lib/attribution/order'
import type { AskNode, Candidate } from '@/lib/attribution/schema'

import { CandidateRow } from './CandidateRow'

/**
 * The candidate picker.
 *
 * Design contract: docs/design/attribution-pivot.md §3.1–3.5. It is rendered twice per
 * form — once for platforms, once for creators — and **does not know which** (§3.1).
 * Everything that would make it know (a "creator" label, a platform-shaped fallback,
 * an avatar-vs-logo branch) is a bug: the same component has to cover podcast → show,
 * trade show → event, retail → store without being edited.
 *
 * Pure presentation. It fetches nothing and posts nothing; the integrator owns the
 * POST/PATCH pair (§5.4).
 *
 * It reports no rendered index of any kind. The server owns the whole of §5.3's
 * `positions` map, and the selected index inside it, because it can rebuild both from
 * (`render_id`, `config_version`, node) — lib/attribution/order.ts is pure, so a
 * recomputation is not a check against a client-supplied map, it IS the map. Sending one
 * from here would make positions two sources of truth that can disagree, and every way
 * they disagreed was a real defect: a mismatch rule that 400s honest submissions, and a
 * selections numerator that a forged request body could skew exactly as forged
 * impressions would. One source cannot disagree with itself.
 */

/**
 * `skipped` (§3.8) is in the union even though this component renders no skip control.
 * The picker has no submit affordance of any kind — the integrator owns the chrome
 * around it along with the POST/PATCH pair (§5.4), so the skip link lives there. What
 * it must not have to invent is a *second* answer shape for a skip: the database CHECK
 * and the server's readAnswer both already accept this one, and an integrator who has
 * to hand-roll `{ skipped: true }` will eventually hand-roll something else.
 */
export type PickAnswer =
  | { candidate_id: string }
  | { raw: string }
  | { dont_remember: true }
  | { skipped: true }

/**
 * Everything the picker knows that the server cannot derive — which is one flag.
 *
 * `selected_via_search` stays here because a filtered pick's rendered index is not the
 * index the position model (§6.2) is fitting: someone who types "jad" and takes the only
 * match did not choose row 0 over eleven alternatives. The server sees the same list the
 * respondent did but not which keystrokes narrowed it, so this is genuinely unknowable
 * upstream. It only ever SUPPRESSES a position, never invents one, so a client that lies
 * about it withholds its own data point and can move nothing else.
 */
export type PickMeta = {
  selected_via_search: boolean
}

type CandidatePickerProps = {
  node: AskNode
  /** Already ordered by lib/attribution/order.ts — `fixed` verbatim, `rotate` permuted. */
  ordered: Candidate[]
  onPick: (answer: PickAnswer, meta: PickMeta) => void
  disabled?: boolean
  autoFocusSearch?: boolean
}

/**
 * `MAX_VISIBLE` is imported rather than declared here on purpose. It is simultaneously
 * this component's visible-row cap and the cap the server's `positionsOf` applies when
 * it rebuilds the impressions map, and the two have to be the same number: a local copy
 * that drifts upward books impressions for rows that were never in the DOM, which the
 * model cannot detect and the rollup reports as confident nonsense. Since the server no
 * longer compares its map against anything the client sends, this import is the *only*
 * thing keeping the two renders in agreement.
 *
 * There is deliberately no "show all" disclosure to go with the cap. A pick from an
 * expanded-but-unsearched list has no defensible position: it was not in the initial
 * render, so counting it poisons the position model exactly the way §5.3 spends its
 * whole argument preventing, and it would also be a row the server cannot reconstruct.
 * Search already covers the case and is flagged by construction.
 */

type PickerRow =
  | { key: string; kind: 'candidate'; candidate: Candidate }
  | { key: string; kind: 'raw'; text: string }

type Committed = { kind: 'candidate'; id: string } | { kind: 'raw'; text: string } | null

export function CandidatePicker({
  node,
  ordered,
  onPick,
  disabled = false,
  autoFocusSearch = false,
}: CandidatePickerProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  // The picker has no `value` prop and is therefore the only place that knows what was
  // picked. §3's mock keeps the chosen row visible with the follow-up expanded beneath
  // it, in place; a respondent who cannot see their own answer while answering the
  // second question has no way to correct the first.
  const [committed, setCommitted] = useState<Committed>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const baseId = useId()
  const inputId = `${baseId}-search`
  const listId = `${baseId}-list`
  const promptId = `${baseId}-prompt`

  // §3.5 is re-asserted here rather than trusted from upstream. The pinned segment
  // costs one filter and makes "never sorted, never filtered, always last" a property
  // of the thing that renders, not a property of the module that happens to feed it.
  const { orderable, pinned } = useMemo(() => splitPinned(ordered), [ordered])

  const allowFreeText = node.allow_free_text
  const searching = normalize(query).length > 0

  const { rows, hiddenCount, noMatches } = useMemo(
    () => buildRows(orderable, pinned, allowFreeText, query),
    [orderable, pinned, allowFreeText, query],
  )

  // Filtering can strand the highlight past the end of a shorter list.
  const active = activeIndex >= 0 && activeIndex < rows.length ? activeIndex : -1

  // The list keeps the height of its initial unfiltered render. Without this it
  // collapses from twelve rows to one as the query narrows, and this component renders
  // inside an iframe whose height is reported to the host by a ResizeObserver — so
  // every character typed reflows the host's checkout page around the embed.
  //
  // Both terms are CSS variables rather than numbers because the first version of this
  // computed the row box from CandidateRow's `min-h-11` (2.75rem) while the real
  // border-box was 3.125rem — the 2rem icon plus py-2 plus the 1px border — so it
  // under-reserved by 12% per row and the list collapsed anyway. The row and the
  // reservation now read the same declaration, so they cannot drift again.
  const reservedRows = Math.min(orderable.length, MAX_VISIBLE) + pinned.length
  const reservedHeight = `calc(${reservedRows} * var(--picker-row-h) + ${Math.max(reservedRows - 1, 0)} * var(--picker-row-gap))`

  // Only when the typed text is not itself on offer. Where free text is allowed the row
  // above already says what to do with it, and pairing "no matches" with "use as typed"
  // reads as a dead end next to the way out of it.
  const listNote =
    hiddenCount > 0
      ? `${hiddenCount} more — type to narrow the list`
      : noMatches && !allowFreeText
        ? 'No matches. Try fewer letters.'
        : ''

  useEffect(() => {
    if (active < 0) {
      return
    }

    document.getElementById(`${baseId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, baseId])

  useEffect(() => {
    if (!autoFocusSearch) {
      return
    }

    // preventScroll because this form is an iframe inside someone else's checkout:
    // focusing a field scrolls the host page to it, and a host who put the embed below
    // the fold gets their page yanked on load. The integrator should only pass
    // autoFocusSearch for a follow-up node, where the respondent has already engaged —
    // Chrome also blocks plain autofocus in cross-origin iframes and logs an error in
    // the host's console.
    inputRef.current?.focus({ preventScroll: true })
  }, [autoFocusSearch])

  function pick(row: PickerRow) {
    if (disabled) {
      return
    }

    if (row.kind === 'raw') {
      const text = row.text.trim()

      if (text.length === 0) {
        return
      }

      setCommitted({ kind: 'raw', text })
      onPick({ raw: text }, { selected_via_search: true })
      return
    }

    const candidate = row.candidate

    setCommitted({ kind: 'candidate', id: candidate.id })
    onPick(
      // `dont_remember` is the semantic flag and `pinned` is a layout instruction; they
      // are separate fields for exactly this call site. Reading the escape hatch off
      // `pinned` discards the candidate_id of every pinned row, and §3.5 pins real
      // no-platform fallbacks like "A friend or colleague" too — so that channel stops
      // being reported as a channel and lands in the rollup's unresolved bucket, where
      // nothing distinguishes it from a respondent who genuinely did not remember.
      candidate.dont_remember === true ? { dont_remember: true } : { candidate_id: candidate.id },
      {
        // A pinned row is on screen whether or not anything was typed — search never
        // surfaced it — so it is not a search result even when a query was in the box,
        // and flagging it would discard a position that §6.2's fitter drops anyway.
        selected_via_search: candidate.pinned !== 'end' && searching,
      },
    )
  }

  function move(delta: number) {
    if (rows.length === 0) {
      return
    }

    setActiveIndex(
      active < 0
        ? delta > 0
          ? 0
          : rows.length - 1
        : (active + delta + rows.length) % rows.length,
    )
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // An IME's Enter commits the composition; treating it as a pick would submit an
    // answer the respondent was still in the middle of typing. The catalog carries
    // 小红书 and 微信 aliases, so CJK input is expected, not hypothetical.
    if (event.nativeEvent.isComposing) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
      return
    }

    if (event.key === 'Enter') {
      // Unconditionally, before the early return. Enter in a text input with nothing
      // highlighted otherwise reaches the browser default, and the embed can be dropped
      // inside a host's own <form> — where that default submits their checkout. Same
      // hazard the clear button's type="button" already guards against.
      event.preventDefault()

      if (active < 0) {
        return
      }

      pick(rows[active])
      return
    }

    if (event.key === 'Escape' && query.length > 0) {
      // Only swallowed when there is something to clear. The embed sits inside host
      // UI that may itself close on Escape, and stealing the key from a host's modal
      // to do nothing is a bug the host cannot fix from outside the iframe.
      event.preventDefault()
      clear()
    }
  }

  function clear() {
    setQuery('')
    setActiveIndex(-1)
    inputRef.current?.focus({ preventScroll: true })
  }

  function onQueryChange(value: string) {
    setQuery(value)

    // Built for the query that is REPLACING this render's, which is why it is recomputed
    // rather than read off `rows` — those describe the query being thrown away, and an
    // index into them lands on a different row of the list that is about to exist.
    // An emptied box comes back -1: an unfiltered list has no "what they meant", so a
    // stray Enter would otherwise book a real answer nobody aimed at.
    setActiveIndex(buildRows(orderable, pinned, allowFreeText, value).defaultActive)
  }

  return (
    <div className="w-full" role="group" aria-labelledby={promptId}>
      <p id={promptId} className="text-base font-medium text-slate-900 dark:text-slate-100">
        {node.prompt}
      </p>

      <div className="relative mt-3">
        <label htmlFor={inputId} className="sr-only">
          Search the list, or type your own answer
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-controls={listId}
          aria-expanded
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${baseId}-opt-${active}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={allowFreeText ? 'Search or type your own' : 'Search'}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-9 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            aria-label="Clear search"
            // type="button" is load-bearing: the embed can be dropped inside a host's
            // own <form>, where a default-type button submits their checkout.
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
          >
            <span aria-hidden>×</span>
          </button>
        ) : null}
      </div>

      {/* §3.4: the empty state shows the candidates themselves. People do not
          spontaneously type, so a bare search box over an empty list would tank
          completion — and completion is the multiplier on everything else (§1). */}
      <ul
        id={listId}
        role="listbox"
        aria-labelledby={promptId}
        aria-disabled={disabled || undefined}
        style={{ minHeight: reservedHeight }}
        className={`mt-2 flex flex-col gap-[var(--picker-row-gap)] ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        {/* The row INDEX, not the candidate id, is what goes in a DOM id: candidate
            ids are caller-defined and may hold any 128 characters (§5.1), including
            whitespace and quotes that would not survive being inlined into markup. */}
        {rows.map((row, index) =>
          row.kind === 'raw' ? (
            <CandidateRow
              key={row.key}
              id={`${baseId}-opt-${index}`}
              label={row.text}
              hint="use as typed"
              active={index === active}
              selected={committed?.kind === 'raw' && committed.text === row.text}
              onPick={() => pick(row)}
              onActivate={() => setActiveIndex(index)}
            />
          ) : (
            <CandidateRow
              key={row.key}
              id={`${baseId}-opt-${index}`}
              label={row.candidate.label}
              handle={row.candidate.handle}
              iconUrl={row.candidate.icon_url}
              tileColor={row.candidate.tile_color}
              dontRemember={row.candidate.dont_remember === true}
              active={index === active}
              selected={committed?.kind === 'candidate' && committed.id === row.candidate.id}
              onPick={() => pick(row)}
              onActivate={() => setActiveIndex(index)}
            />
          ),
        )}
      </ul>

      {/* Always mounted, text swapped, and tall enough for one line whether or not there
          is one. Mounting and unmounting this paragraph moved the document height on the
          first and last keystroke of every query — the same host-page reflow the
          listbox's reserved height exists to stop, arriving one line further down.
          leading-5 matches min-h-5 so a line of text exactly fills the reserved box. */}
      <p className="mt-2 min-h-5 px-3 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
        {listNote}
      </p>

      {/* Filtering happens with focus in the input, where a screen reader announces
          nothing about a list changing underneath it. */}
      <p role="status" aria-live="polite" className="sr-only">
        {searching ? describeRows(rows) : ''}
      </p>
    </div>
  )
}

/**
 * Everything derived from one query, in one pure function.
 *
 * Pure and standalone because it has two callers: the render, for the query that is on
 * screen, and `onQueryChange`, for the query that is about to replace it. The keystroke
 * handler used to re-derive its own approximation of "is anything highlightable", which
 * is how the highlight came to disagree with the rows it was indexing into.
 */
function buildRows(
  orderable: Candidate[],
  pinned: Candidate[],
  allowFreeText: boolean,
  query: string,
): { rows: PickerRow[]; hiddenCount: number; noMatches: boolean; defaultActive: number } {
  const term = normalize(query)
  const searching = term.length > 0
  const matches = searching ? rankMatches(orderable, term) : orderable
  const visible = matches.slice(0, MAX_VISIBLE)

  const rows: PickerRow[] = visible.map((candidate) => ({
    key: `c:${candidate.id}`,
    kind: 'candidate',
    candidate,
  }))

  // §3.4: no "Other". The typed text *is* an option — offered in place, in the list, at
  // the same weight as everything else.
  //
  // Offered ALONGSIDE the matches, not only instead of them. Gating it on zero matches
  // strands the respondent whose creator is "Tom" while the list holds "Tommy": they
  // get one irrelevant row and no way at all to say what they meant, which is precisely
  // the "pick something wrong" nudge removing the Other option was supposed to delete.
  // It goes after the matches because a row made of the respondent's own keystrokes
  // always matches the query better than anything, and putting it first would push the
  // real answer down the list on the way to typing it.
  const typed = query.trim()

  if (searching && allowFreeText && typed.length > 0 && !isExactlyOnOffer(visible, pinned, term)) {
    rows.push({ key: 'raw', kind: 'raw', text: typed })
  }

  // Pinned rows are appended unconditionally — §3.5's "never filtered" — but they are
  // still *matched* below. Leaving them out of matching entirely meant a respondent who
  // typed the label of the pinned row sitting on their screen got the free-text row
  // highlighted instead, and Enter recorded `{raw}` for an option they could see.
  for (const candidate of pinned) {
    rows.push({ key: `c:${candidate.id}`, kind: 'candidate', candidate })
  }

  const pinnedMatched = searching && pinned.some((candidate) => matchScore(candidate, term) !== null)

  return {
    rows,
    hiddenCount: matches.length - visible.length,
    noMatches: searching && visible.length === 0 && !pinnedMatched,
    defaultActive: searching ? bestRow(rows, term) : -1,
  }
}

/**
 * Which row a bare Enter should take, right after a keystroke.
 *
 * The best-scoring candidate row anywhere in the list, pinned segment included, and only
 * the free-text row when nothing matched at all. Scoring the rows rather than assuming
 * row 0 is what lets a matching pinned row win from the bottom of the list.
 *
 * When nothing matches and free text is off this returns -1 rather than 0, because row 0
 * is then the pinned escape hatch: highlighting it means Enter silently books "I don't
 * remember", a non-answer the respondent never chose, which is the
 * noise-disguised-as-signal §3.5 exists to prevent. A pinned row is only ever
 * auto-highlighted when the respondent typed toward it.
 */
function bestRow(rows: PickerRow[], term: string): number {
  let best = -1
  let bestScore = Number.POSITIVE_INFINITY
  let raw = -1

  rows.forEach((row, index) => {
    if (row.kind === 'raw') {
      raw = index
      return
    }

    const score = matchScore(row.candidate, term)

    // Strict `<`, so a tie keeps the earlier row — which is the one rankMatches already
    // decided was the better answer.
    if (score !== null && score < bestScore) {
      bestScore = score
      best = index
    }
  })

  return best >= 0 ? best : raw
}

/**
 * What the polite live region says.
 *
 * It counts the rows that can actually be chosen, not the matches. Announcing the match
 * count told a screen-reader user "0 matching options" while the free-text row and the
 * pinned escape hatch were both on screen and selectable — the two rows a respondent
 * who found nothing most needs to hear about, and the only ones that stop them
 * abandoning the form or guessing.
 *
 * The pinned rows are named by their own labels rather than described, because this
 * component does not know what it is asking about (§3.1): the caller may have written
 * "I don't remember", "I don't remember who", or "A friend or colleague".
 */
function describeRows(rows: PickerRow[]): string {
  const count = `${rows.length} ${rows.length === 1 ? 'option' : 'options'}`
  const escapes: string[] = []

  if (rows.some((row) => row.kind === 'raw')) {
    escapes.push('use what you typed')
  }

  for (const row of rows) {
    if (row.kind === 'candidate' && row.candidate.pinned === 'end') {
      escapes.push(row.candidate.label)
    }
  }

  return escapes.length > 0 ? `${count}, including ${escapes.join(', ')}` : count
}

/**
 * Whether the query already *is* one of the rows on offer.
 *
 * Only against rows the respondent can see: an exact match sitting past MAX_VISIBLE is
 * not an answer they can reach, so suppressing the free-text row on its account would
 * leave them with no way to give it. The pinned segment is always on screen, so it
 * always counts — a free-text row spelling out the pinned label verbatim is a duplicate
 * of a row two lines below it, and picking it records `{raw}` for a candidate that had
 * a perfectly good id.
 */
function isExactlyOnOffer(visible: Candidate[], pinned: Candidate[], term: string): boolean {
  return [...visible, ...pinned].some(
    (candidate) =>
      normalize(candidate.label) === term ||
      (candidate.handle !== undefined && normalize(candidate.handle) === term),
  )
}

function splitPinned(ordered: Candidate[]) {
  const orderable: Candidate[] = []
  const pinned: Candidate[] = []

  for (const candidate of ordered) {
    if (candidate.pinned === 'end') {
      pinned.push(candidate)
    } else {
      orderable.push(candidate)
    }
  }

  return { orderable, pinned }
}

/**
 * Filter and rank, over label, handle and aliases (§3.4).
 *
 * Reordering the list under a query is free of consequences precisely because a
 * search-filtered pick is flagged `selected_via_search` and dropped from the position
 * model (§5.3) — there is no impression to bias. So rank by how directly the text
 * matched: without this, one-letter queries surface whatever happens to carry that
 * letter in an alias ahead of the brand the respondent is typing.
 *
 * Aliases are matched and never displayed. They exist because people remember
 * descriptions — "the one who does office stuff" — not handles.
 */
function rankMatches(candidates: Candidate[], term: string): Candidate[] {
  const scored: Array<{ candidate: Candidate; score: number }> = []

  for (const candidate of candidates) {
    const score = matchScore(candidate, term)

    if (score !== null) {
      scored.push({ candidate, score })
    }
  }

  // Array.prototype.sort is stable, so candidates that matched equally well keep the
  // order lib/attribution/order.ts gave them.
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.candidate)
}

function matchScore(candidate: Candidate, term: string): number | null {
  const label = normalize(candidate.label)

  if (label.startsWith(term)) {
    return 0
  }

  const handle = candidate.handle ? normalize(candidate.handle) : ''

  if (handle.length > 0 && handle.startsWith(term)) {
    return 1
  }

  if (label.includes(term)) {
    return 2
  }

  if (handle.includes(term)) {
    return 3
  }

  if (candidate.aliases?.some((alias) => normalize(alias).includes(term))) {
    return 4
  }

  return null
}

/**
 * Fold to a comparable form: case, accents, a leading @, full-width characters.
 *
 * The accent stripping is not decoration. A creator named "José" is unreachable if the
 * respondent has to produce the accent to find them, and nobody types the accent.
 */
function normalize(value: string): string {
  return value
    .trim()
    .replace(/^@+/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
