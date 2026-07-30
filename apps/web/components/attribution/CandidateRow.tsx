'use client'

import { useState } from 'react'

import { LOGO_METRICS } from '@/lib/catalog/logo-metrics'

import { Monogram } from './Monogram'

/**
 * One row of the picker's listbox.
 *
 * Props are the row's *presentation*, not a `Candidate`, so the "use what you typed"
 * row can render through the same component. That is not tidiness: §3.4 removes the
 * "Other" option on the argument that typing your own should cost one less click and
 * feel like one less nudge toward picking something wrong. If the free-text row looked
 * like a secondary affordance instead of an option, the nudge would come back through
 * the styling.
 *
 * Three things are shown — icon, label, handle — because any of the three might be the
 * one a respondent recognizes (§3.4). Aliases are matched by the picker's search and
 * deliberately never appear here.
 */

type CandidateRowProps = {
  /** DOM id, referenced by the input's aria-activedescendant. */
  id: string
  label: string
  handle?: string
  iconUrl?: string
  /**
   * Brand color for the fallback tile, copied onto the candidate at configure time. Set
   * only for a catalog entry that names a brand but ships no mark; absent for anything
   * the catalog classifies as a description of an experience.
   */
  tileColor?: string
  /** Muted trailing text where a handle would go. Used by the free-text row. */
  hint?: string
  /** Keyboard/pointer highlight. At most one row at a time. */
  active: boolean
  /** The committed answer. Distinct from `active`; both can be true. */
  selected: boolean
  onPick: () => void
  onActivate: () => void
}

export function CandidateRow({
  id,
  label,
  handle,
  iconUrl,
  tileColor,
  hint,
  active,
  selected,
  onPick,
  onActivate,
}: CandidateRowProps) {
  // A caller-supplied avatar URL that 404s or gets blocked by the host page's CSP
  // would otherwise leave a broken-image glyph in the one slot the whole scanning
  // argument depends on. Fall back to the tile the moment the load fails.
  const [iconFailed, setIconFailed] = useState(false)

  // A tile is earned by having an identity to recognize — a brand (its colour arrives as
  // tileColor) or a person (a handle is what makes one).
  //
  // The obvious rule, "no catalog entry means it is caller-defined and therefore a person",
  // is wrong: the "I don't remember" row is caller-defined too, and it was getting a purple
  // ID badge that made a non-answer read as a brand sitting among the real ones. A
  // description carries itself with its label.
  const showTile = tileColor !== undefined || handle !== undefined

  // Keyed by our own /logos/ slug. Deliberately read here rather than copied into the config
  // snapshot: unlike a label or a colour, these two numbers describe the ASSET FILE and are
  // regenerated with it, so a stored copy would be the thing that goes stale the day a brand
  // reissues its mark on a different canvas. A caller-supplied avatar URL matches nothing and
  // gets the defaults, which is the correct answer for a photograph.
  const slug = iconUrl?.startsWith('/logos/') ? iconUrl.slice(7, -4) : undefined
  const metric = (slug ? LOGO_METRICS[slug] : undefined) ?? { scale: 1, invert: false }

  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onClick={onPick}
      // Keep focus in the search input on a mouse pick, so the next keystroke still
      // filters instead of going nowhere. Without this the caret is lost on click and
      // a respondent who mixes mouse and keyboard has to click back into the field.
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={onActivate}
      // --picker-row-h, not a literal: CandidatePicker reserves the listbox's height as
      // a multiple of this row's box so the list does not collapse (and reflow the host
      // page around the embed) on the first keystroke. When the two were written out
      // separately the reservation used min-h-11 while this row measured 3.125rem —
      // 2rem icon + py-2 + the 1px border — and under-reserved every row.
      className={`flex min-h-[var(--picker-row-h)] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition ${
        selected
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : active
            ? 'border-transparent bg-black/[0.05] dark:bg-white/[0.08]'
            : 'border-transparent'
      }`}
    >
      {iconUrl && !iconFailed ? (
        // NO TILE behind a platform mark.
        //
        // A tile was tried and it is wrong for most of these: roughly two thirds of the marks
        // are containers carrying their own coloured square or circle — Instagram, LinkedIn,
        // YouTube, Telegram, Reddit — and a container inside a white tile is a square inside a
        // square. Without one, containers read as native app icons and a bare glyph sits on the
        // row as the glyph it is.
        //
        // What the tile was solving was the four monochrome near-black marks vanishing on a
        // dark surface. `invert` solves that precisely instead, and it is the only thing that
        // can: an SVG loaded through <img> is a separate document whose fills page CSS cannot
        // touch, but a filter applies to the rendered result. The flag is measured from the
        // file, never guessed — inverting a multi-colour mark would render a negative of
        // somebody's logo.
        //
        // A caller-supplied avatar is a photograph: it fills a rounded square, takes no optical
        // correction, and is never inverted. It matches no entry in the metrics table because
        // the table is keyed by our own /logos/ slugs, so it falls through to the defaults.
        //
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          onError={() => setIconFailed(true)}
          style={metric.scale === 1 ? undefined : { transform: `scale(${metric.scale})` }}
          className={
            handle
              ? 'h-8 w-8 shrink-0 rounded-lg object-cover'
              : `h-5 w-5 shrink-0${metric.invert ? ' dark:invert' : ''}`
          }
        />
      ) : showTile ? (
        <Monogram label={label} color={tileColor} />
      ) : (
        // Deliberately nothing — not an empty box. A descriptive option ("A friend or
        // colleague told me") has no identity to recognize, so a two-letter badge there
        // is noise that competes with the real logos beside it for the eye and makes the
        // scan §3.2 depends on slower rather than faster. The label carries it alone.
        <span aria-hidden className="w-8 shrink-0" />
      )}

      <span className="min-w-0 flex-1 truncate text-[15px] leading-6 text-slate-900 dark:text-slate-100">
        {label}
      </span>

      {handle ? (
        <span className="max-w-[45%] shrink-0 truncate font-mono text-[12px] text-slate-500 dark:text-slate-400">
          {formatHandle(handle)}
        </span>
      ) : hint ? (
        <span className="shrink-0 text-[12px] text-slate-500 dark:text-slate-400">{hint}</span>
      ) : null}

      {selected ? (
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0 text-[var(--accent)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5 6.5 12 13 4.5" />
        </svg>
      ) : null}
    </li>
  )
}

// Callers supply handles both ways ("@jade.work0" and "jade.work0"); the @ is what
// makes it read as a handle rather than as a second name, so it is added here rather
// than demanded of the caller.
function formatHandle(handle: string): string {
  return handle.startsWith('@') ? handle : `@${handle}`
}
