import { monogram } from '@/lib/catalog/platforms'

/**
 * The fallback tile for a candidate with no icon.
 *
 * This is a primary path, not an edge case. simple-icons has no mark for ChatGPT,
 * LinkedIn or Slack following trademark requests (see lib/catalog/platforms.ts), and
 * ChatGPT is the headline channel of the whole positioning. Caller-supplied creator
 * avatars are missing just as often. §3.2 rests on "recognition all the way down", so
 * every row needs *something* for the eye to land on while scanning; an empty square
 * would break the scan that makes a 12–15 row list affordable (§3.3).
 *
 * No 'use client' directive: this renders no hooks and no handlers, so it stays usable
 * from a server component. The directive on its importers covers the picker's needs.
 */

type MonogramProps = {
  label: string
  /**
   * `tile_color` off the candidate, copied into the config snapshot at configure
   * time. Absent for a caller-defined candidate (a creator, a show, an event), which
   * falls through to the fixed palette below.
   *
   * Previously this component took a `catalog_slug` and read the color out of the live
   * catalog. Cosmetic, but the same mistake §4 exists to prevent — a palette change
   * would have silently repainted every historical render.
   */
  color?: string
  className?: string
}

export function Monogram({ label, color, className }: MonogramProps) {
  const background = color ?? tileColor(label)

  return (
    <span
      // Decorative: the label sits immediately to its right in every row that uses
      // this, so announcing "T I, TikTok" is noise.
      aria-hidden
      style={{ backgroundColor: background, color: foregroundOn(background) }}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold leading-none ${className ?? ''}`}
    >
      {monogram(label)}
    </span>
  )
}

/**
 * Eight hand-picked tiles for candidates with no catalog entry — creators, shows,
 * events. Hashing a label into an arbitrary HSL hue produces the occasional muddy or
 * neon tile next to a real brand logo; a fixed set cannot. All eight are dark enough
 * that white text clears 4.5:1, which `foregroundOn` then double-checks anyway for the
 * catalog colors it does not control.
 */
const TILES = [
  '#2F5D62',
  '#4B5FA8',
  '#7A4E9B',
  '#A34A6B',
  '#B3542F',
  '#2E6B45',
  '#4A5568',
  '#8A5A3C',
] as const

function tileColor(label: string): string {
  // FNV-1a. Any stable hash does; this one is three lines and has no dependency.
  let hash = 0x811c9dc5

  for (let index = 0; index < label.length; index += 1) {
    hash = Math.imul(hash ^ label.charCodeAt(index), 0x01000193) >>> 0
  }

  return TILES[hash % TILES.length]
}

/**
 * Black or white, whichever contrasts better.
 *
 * Not a constant, because brand colors are not all dark: Snapchat's is #FFFC00, and
 * white text on it is invisible. Catalog colors come from the brands, so this side of
 * the decision cannot be made once at authoring time.
 */
function foregroundOn(background: string): string {
  const luminance = relativeLuminance(background)

  // WCAG contrast ratios against the two candidates, compared without dividing.
  return (luminance + 0.05) * (luminance + 0.05) > 0.05 * 1.05 ? '#111827' : '#ffffff'
}

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())

  if (!match) {
    // Unparseable color means an unknown background, and white-on-unknown is the
    // likelier failure. Assume dark.
    return 0
  }

  const value = parseInt(match[1], 16)
  const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((byte) => {
    const channel = byte / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
