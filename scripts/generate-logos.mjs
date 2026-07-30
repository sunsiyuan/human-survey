// Emits apps/web/public/logos/{slug}.svg for every catalog platform that has a mark
// in simple-icons (CC0). Run after changing the catalog:
//
//   node scripts/generate-logos.mjs
//
// Platforms with no entry here fall back to a monogram tile rendered from the
// catalog's brand color — see lib/catalog/platforms.ts. Some well-known brands are
// deliberately absent from simple-icons after trademark requests (LinkedIn, OpenAI
// and Slack among them), so the fallback is not an edge case; it is the path for
// several of the most common channels, ChatGPT included.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as icons from 'simple-icons'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'apps/web/public/logos')

// catalog slug -> simple-icons export name
const MARKS = {
  tiktok: 'siTiktok',
  instagram: 'siInstagram',
  youtube: 'siYoutube',
  x: 'siX',
  facebook: 'siFacebook',
  reddit: 'siReddit',
  xiaohongshu: 'siXiaohongshu',
  twitch: 'siTwitch',
  pinterest: 'siPinterest',
  snapchat: 'siSnapchat',

  claude: 'siClaude',
  perplexity: 'siPerplexity',
  gemini: 'siGooglegemini',

  google: 'siGoogle',
  duckduckgo: 'siDuckduckgo',

  spotify: 'siSpotify',
  'apple-podcasts': 'siApplepodcasts',

  discord: 'siDiscord',
  substack: 'siSubstack',
  hackernews: 'siYcombinator',
  producthunt: 'siProducthunt',
  github: 'siGithub',
  quora: 'siQuora',
  medium: 'siMedium',
  notion: 'siNotion',

  whatsapp: 'siWhatsapp',
  telegram: 'siTelegram',
  wechat: 'siWechat',
  line: 'siLine',
}

mkdirSync(OUT, { recursive: true })

let written = 0
const missing = []

for (const [slug, exportName] of Object.entries(MARKS)) {
  const icon = icons[exportName]

  if (!icon) {
    missing.push(`${slug} (${exportName})`)
    continue
  }

  // currentColor rather than the brand hex: the picker renders marks monochrome so a
  // row of fifteen logos reads as one list instead of a fruit salad, and so dark mode
  // works without a second asset. Brand color still carries in the monogram fallback.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" ` +
    `role="img" aria-label="${icon.title}"><title>${icon.title}</title>` +
    `<path d="${icon.path}"/></svg>\n`

  writeFileSync(join(OUT, `${slug}.svg`), svg)
  written += 1
}

console.log(`wrote ${written} logo(s) to apps/web/public/logos/`)

if (missing.length) {
  console.error(`\nnot found in simple-icons:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}
