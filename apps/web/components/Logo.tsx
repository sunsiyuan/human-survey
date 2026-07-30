/**
 * The HumanSurvey mark.
 *
 * A head over a filled row, with a second row beneath it. At favicon size only the head and
 * the filled row resolve, so it reads as a person — which is the half of the idea the name
 * carries, and the right thing to degrade toward. As it grows the second row appears and it
 * becomes a person above a chosen row: one answer picked out of a list, which is the whole of
 * what this product collects.
 *
 * currentColor, so it takes the colour of whatever it sits in. The favicon at app/icon.svg is
 * a separate file with the mark knocked out of a filled square — a bare dark mark vanishes on
 * a dark browser tab and a bare light one vanishes on a light tile, so there the square has to
 * own its own background.
 */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <circle cx="12" cy="6.2" r="2.9" />
      <rect x="2.6" y="11.6" width="18.8" height="4.3" rx="2.15" />
      <rect x="5.2" y="17.6" width="13.6" height="2.4" rx="1.2" opacity=".34" />
    </svg>
  )
}

/** Mark plus wordmark, for a page header. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <Logo size={22} className="text-[var(--accent-strong)]" />
      <span className="font-serif text-[19px] font-semibold tracking-[-0.01em] text-[var(--accent-strong)]">
        HumanSurvey
      </span>
    </span>
  )
}
