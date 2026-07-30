// Fetches the official brand mark for every platform in the catalog into
// apps/web/public/logos/{slug}.svg. Run after changing the catalog:
//
//   node scripts/generate-logos.mjs
//
// TWO SOURCES, in this order:
//
//   1. svgl (https://svgl.app) — the brands' own marks, in full colour. This is the source
//      that matters: Google's four-colour G, Instagram's gradient, TikTok's offset note.
//      It also carries LinkedIn, OpenAI, Slack and Bing, all four of which were withdrawn
//      from simple-icons after trademark requests — and one of them is ChatGPT, the headline
//      channel of the whole positioning.
//
//   2. simple-icons (CC0) — single-colour silhouettes, used only for the handful svgl has no
//      entry for. Filled with the brand's own hex so they still read as that brand.
//
// A hand-placed file wins over both and is never overwritten. If you obtain an official asset
// from a brand's own press kit — which usually means accepting brand terms that a script has
// no business accepting on your behalf — drop it in as {slug}.svg and it stays.
//
// ON USING THESE AT ALL: showing a brand's mark so that a person can point at the one they
// used is nominative use — identifying the brand, not implying its endorsement. It is the same
// basis every "sign in with X" button and every competitor's channel list stands on. The marks
// remain the trademarks of their owners; nothing here licenses them for any other purpose.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { optimize } from 'svgo'
import * as icons from 'simple-icons'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'apps/web/public/logos')

const GENERATED = '<!--generated-by-scripts/generate-logos.mjs-->'

// catalog slug -> the title svgl files it under
const SVGL = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  twitch: 'Twitch',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
  chatgpt: 'OpenAI',
  claude: 'Claude AI',
  perplexity: 'Perplexity AI',
  gemini: 'Gemini',
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  spotify: 'Spotify',
  reddit: 'Reddit',
  discord: 'Discord',
  slack: 'Slack',
  github: 'GitHub',
  notion: 'Notion',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
}

// catalog slug -> simple-icons export, for the ones svgl has no entry for
const FALLBACK = {
  x: 'siX',
  // svgl lists Product Hunt but its file 404s, so this one is a fallback in practice.
  producthunt: 'siProducthunt',
  xiaohongshu: 'siXiaohongshu',
  'apple-podcasts': 'siApplepodcasts',
  hackernews: 'siYcombinator',
  substack: 'siSubstack',
  medium: 'siMedium',
  quora: 'siQuora',
  wechat: 'siWechat',
  line: 'siLine',
}

/**
 * Everything a mark needs at 20 CSS pixels, and nothing else.
 *
 * These files arrive between 300 B and 8 KB, and the 8 KB ones are 8 KB because they carry
 * gradients, clip paths and six decimal places of coordinate precision that describe detail no
 * viewer will ever resolve. Reddit's snoo alone shipped 23 colours and a gradient.
 *
 * `floatPrecision: 2` is the setting that does most of the work. It is safe here because the
 * marks render inside a 20 px box: two decimals on a 256-unit viewBox is a tenth of a rendered
 * pixel. Raising it would be pure bytes.
 */
const SVGO = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Ids are referenced by the gradients and clip paths several of these use, and a
          // minified id collides across files the moment two marks are inlined into one
          // document.
          cleanupIds: false,
          // Precision has to be set on the plugins that consume it, not at the top level —
          // a top-level floatPrecision is accepted and silently ignored, which is how the
          // first pass at this managed a 20% saving instead of a 60% one.
          convertPathData: { floatPrecision: 2 },
          cleanupNumericValues: { floatPrecision: 2 },
          convertTransform: { floatPrecision: 2 },
        },
      },
    },
    'removeDimensions',
  ],
}

/**
 * How much to scale a mark so it looks the same size as its neighbours.
 *
 * The marks have wildly different aspect ratios — YouTube is 256×180, Bing is 256×388, Twitch
 * is 2400×2800 — and an <img> box fits them with `meet`, so the longer side hits the box and
 * the shorter one falls short. Twenty pixels of BOX therefore produces a different amount of
 * INK per mark: YouTube renders 20×14, Bing renders 13×20. That mismatch is most of what makes
 * a row of logos look amateur, and no amount of picking a nicer box size fixes it.
 *
 * Equalising rendered AREA rather than bounding box: area after `meet` is proportional to
 * min(r, 1/r), so scaling by 1/sqrt(min(r, 1/r)) makes every mark cover the same ink. Square
 * marks come out at 1.0 and are untouched.
 *
 * Capped, because the correction is only valid while the mark still fits its row: a very tall
 * mark scaled to equal area would overflow a 32 px tile vertically.
 */
function opticalScale(width, height) {
  if (!width || !height) {
    return 1
  }

  const ratio = width / height
  const shortSide = Math.min(ratio, 1 / ratio)

  return Math.min(1 / Math.sqrt(shortSide), 1.25)
}

/**
 * Whether this mark should be inverted on a dark surface.
 *
 * The picker gives marks no background — a tile behind them was tried and it is wrong for
 * half of them: about two thirds of these marks are containers that carry their own coloured
 * square or circle (Instagram, LinkedIn, YouTube, Telegram, Reddit…), and a container inside a
 * white tile is a square inside a square. Removing the tile makes those look native and lets a
 * bare glyph sit on the row like the glyph it is.
 *
 * What the tile was solving was the near-black marks — TikTok's note, OpenAI's rosette, X,
 * GitHub — disappearing on a dark surface. `filter: invert()` solves it properly instead, and
 * it works where recolouring cannot: an SVG loaded through <img> is an independent document
 * whose fills the page's CSS cannot reach, but a filter applies to the rendered image.
 *
 * Only safe on a mark that is ONE dark colour, which is exactly the set that needs it —
 * inverting a multi-colour mark would produce a photographic negative of a brand's logo. So
 * the condition is measured from the file rather than declared: at most one distinct colour,
 * and that colour dark. A mark with no explicit fill counts as black, because that is what it
 * renders as.
 */
function invertOnDark(svg) {
  const colors = new Set(
    (svg.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}\b/g) ?? []).map((hex) => hex.toLowerCase()),
  )

  if (colors.size > 1) {
    return false
  }

  const hex = [...colors][0] ?? '#000000'
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex
  const channels = (full.slice(1).match(/../g) ?? []).map((pair) => {
    const value = parseInt(pair, 16) / 255
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  })

  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]

  return luminance < 0.12
}

function readViewBox(svg) {
  const match = /viewBox="([^"]+)"/.exec(svg)

  if (!match) {
    return null
  }

  const parts = match[1].trim().split(/[\s,]+/).map(Number)

  return parts.length === 4 ? { width: parts[2], height: parts[3] } : null
}

/**
 * svgl serves some marks as a {light, dark} pair, for brands whose mark is near-black and
 * needs inverting on a dark surface. We always take the LIGHT one, because the picker puts
 * every mark on a light tile regardless of the viewer's theme — which is the whole reason
 * that tile exists (see components/attribution/CandidateRow.tsx).
 */
function pickRoute(route) {
  return typeof route === 'string' ? route : (route?.light ?? route?.dark ?? null)
}

mkdirSync(OUT, { recursive: true })

const index = await fetch('https://api.svgl.app').then((response) => {
  if (!response.ok) {
    throw new Error(`svgl index returned ${response.status}`)
  }

  return response.json()
})

const bySvglTitle = new Map(index.map((entry) => [(entry.title ?? '').toLowerCase(), entry]))

let official = 0
let fallback = 0
let kept = 0
let bytesBefore = 0
let bytesAfter = 0
const failed = []
const metrics = {}

function write(slug, raw) {
  bytesBefore += raw.length

  const { data } = optimize(raw, SVGO)
  const box = readViewBox(data)

  bytesAfter += data.length
  metrics[slug] = {
    scale: Number(opticalScale(box?.width, box?.height).toFixed(3)),
    invert: invertOnDark(data),
  }

  writeFileSync(join(OUT, `${slug}.svg`), `${data}${GENERATED}\n`)
}

function handPlaced(slug) {
  const path = join(OUT, `${slug}.svg`)
  return existsSync(path) && !readFileSync(path, 'utf8').includes(GENERATED)
}

for (const [slug, title] of Object.entries(SVGL)) {
  if (handPlaced(slug)) {
    kept += 1
    continue
  }

  const entry = bySvglTitle.get(title.toLowerCase())
  const url = entry ? pickRoute(entry.route) : null

  if (!url) {
    failed.push(`${slug}: svgl has no entry titled "${title}"`)
    continue
  }

  const response = await fetch(url)

  if (!response.ok) {
    failed.push(`${slug}: ${url} returned ${response.status}`)
    continue
  }

  const svg = (await response.text()).trim()

  if (!svg.startsWith('<svg')) {
    failed.push(`${slug}: ${url} did not return an SVG`)
    continue
  }

  write(slug, svg)
  official += 1
}

for (const [slug, exportName] of Object.entries(FALLBACK)) {
  if (handPlaced(slug)) {
    kept += 1
    continue
  }

  const icon = icons[exportName]

  if (!icon) {
    failed.push(`${slug}: simple-icons has no ${exportName}`)
    continue
  }

  // The brand's own hex, not currentColor. These load through <img>, where an SVG inherits no
  // colour context at all, so currentColor resolves to plain black for every mark — which is
  // what this generator used to emit, while its comment claimed dark mode worked.
  write(
    slug,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#${icon.hex}" ` +
      `role="img" aria-label="${icon.title}"><title>${icon.title}</title>` +
      `<path d="${icon.path}"/></svg>`,
  )
  fallback += 1
}

// A generated module rather than a hand-kept table: the scale is a pure function of the
// mark's own viewBox, so a hand-maintained copy would silently stop matching the file the
// moment a brand reissues its logo with a different canvas.
const metricsFile = join(ROOT, 'apps/web/lib/catalog/logo-metrics.ts')

writeFileSync(
  metricsFile,
  `// GENERATED by scripts/generate-logos.mjs — do not edit.\n` +
    `//\n` +
    `// scale — equalises rendered AREA across marks whose aspect ratios differ, because an\n` +
    `//   <img> box fits a mark with \`meet\`: 20 px of box gives a wide mark 20×14 of ink and a\n` +
    `//   tall one 13×20, which is most of what makes a row of logos look amateur.\n` +
    `// invert — true only for a mark that is one dark colour, which is the set that disappears\n` +
    `//   on a dark surface. Safe there and nowhere else: inverting a multi-colour mark would\n` +
    `//   render a negative of somebody's logo. Derivations are in the generator.\n` +
    `export type LogoMetric = { scale: number; invert: boolean }\n\n` +
    `export const LOGO_METRICS: Record<string, LogoMetric> = ${JSON.stringify(metrics, null, 2)}\n`,
)

console.log(`${official} official mark(s) from svgl`)
console.log(`${fallback} single-colour fallback(s) from simple-icons`)

if (kept > 0) {
  console.log(`${kept} hand-placed mark(s) left untouched`)
}

const saved = Math.round((1 - bytesAfter / bytesBefore) * 100)
console.log(`${(bytesBefore / 1024).toFixed(1)} KB in, ${(bytesAfter / 1024).toFixed(1)} KB out (${saved}% smaller)`)

const tuned = Object.entries(metrics).filter(([, m]) => m.scale !== 1)
const inverted = Object.entries(metrics).filter(([, m]) => m.invert)
console.log(`${tuned.length} mark(s) need an optical correction; ${Object.keys(metrics).length - tuned.length} are square`)
console.log(`${inverted.length} mark(s) invert on dark: ${inverted.map(([slug]) => slug).join(', ')}`)

if (failed.length > 0) {
  console.error(`\n${failed.length} could not be fetched:\n  ${failed.join('\n  ')}`)
  process.exit(1)
}
