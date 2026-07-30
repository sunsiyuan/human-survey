/**
 * The product-owned platform catalog.
 *
 * Design contract: docs/design/attribution-pivot.md §4. The split that matters:
 * platforms are a finite, stable, well-known set, so their names and marks are ours
 * to maintain centrally. Creator candidates — handles, avatars, aliases — are the
 * caller's, because resolving a vague memory to a specific person is upstream work
 * this product deliberately does not do.
 *
 * A caller does not receive this whole list. They pick the channels they actually
 * run, and `configure` COPIES label and icon into the immutable config snapshot,
 * keeping the slug only for provenance (§4). A logo swap here must never rewrite what
 * an old rollup claims was rendered.
 *
 * Marks are fetched by scripts/generate-logos.mjs into public/logos/{slug}.svg — the brands'
 * own marks from svgl where they exist, single-colour simple-icons silhouettes for the handful
 * svgl has no entry for. EVERY entry ships one today, ChatGPT and LinkedIn included; an earlier
 * revision of this comment said those two had none, which was true when simple-icons was the
 * only source and stopped being true the day svgl became the first one.
 *
 * `hasMark: false` and the monogram fallback are still real paths — a caller-defined creator
 * with no avatar takes them — so do not delete the branch on the grounds that no platform uses
 * it today.
 */

export type PlatformClass =
  | 'creator'
  | 'ai_assistant'
  | 'search'
  | 'podcast'
  | 'community'
  | 'messaging'
  | 'offline'
  | 'word_of_mouth'
  | 'other'

export type CatalogPlatform = {
  /** Stable key. Copied into config snapshots as `catalog_slug` for provenance. */
  slug: string
  /**
   * What the respondent reads. §3.2: a brand name where one exists, because a brand
   * name is the unit of memory and costs zero translation. Only entries with no brand
   * behind them get a descriptive label, and those are phrased as the respondent would
   * describe the experience — not as a taxonomy category.
   */
  label: string
  /** Rollup grouping. Never shown to a respondent. */
  class: PlatformClass
  /** Drives the monogram tile, and nothing else. Marks render monochrome. */
  brandColor: string
  /** Whether public/logos/{slug}.svg exists. False → monogram fallback. */
  hasMark: boolean
  /** Matched by the picker's search, never displayed. */
  aliases?: string[]
  /**
   * Whether this channel usually wants a follow-up question. Advisory only — the
   * caller decides per form, and §10.4 has an agent tune it monthly against spend.
   */
  expandsByDefault?: boolean
}

export const PLATFORMS: readonly CatalogPlatform[] = [
  // --- Creator platforms ------------------------------------------------------
  // These are the reason the product exists. "TikTok" alone is not an answer, so
  // every one of them expands by default.
  { slug: 'tiktok', label: 'TikTok', class: 'creator', brandColor: '#000000', hasMark: true, expandsByDefault: true, aliases: ['douyin', 'short video'] },
  { slug: 'instagram', label: 'Instagram', class: 'creator', brandColor: '#FF0069', hasMark: true, expandsByDefault: true, aliases: ['ig', 'insta', 'reels'] },
  { slug: 'youtube', label: 'YouTube', class: 'creator', brandColor: '#FF0000', hasMark: true, expandsByDefault: true, aliases: ['yt', 'shorts'] },
  { slug: 'x', label: 'X', class: 'creator', brandColor: '#000000', hasMark: true, expandsByDefault: true, aliases: ['twitter', 'tweet'] },
  { slug: 'linkedin', label: 'LinkedIn', class: 'creator', brandColor: '#0A66C2', hasMark: true, expandsByDefault: true, aliases: ['li'] },
  { slug: 'facebook', label: 'Facebook', class: 'creator', brandColor: '#0866FF', hasMark: true, aliases: ['fb', 'meta'] },
  { slug: 'xiaohongshu', label: 'Xiaohongshu', class: 'creator', brandColor: '#FF2442', hasMark: true, expandsByDefault: true, aliases: ['rednote', 'red', 'xhs', '小红书'] },
  { slug: 'twitch', label: 'Twitch', class: 'creator', brandColor: '#9146FF', hasMark: true, expandsByDefault: true },
  { slug: 'pinterest', label: 'Pinterest', class: 'creator', brandColor: '#BD081C', hasMark: true },
  { slug: 'snapchat', label: 'Snapchat', class: 'creator', brandColor: '#FFFC00', hasMark: true },

  // --- AI assistants ----------------------------------------------------------
  // Named individually rather than folded into one "AI assistant" row, for the same
  // reason platforms beat "social media": people remember the product they used.
  // These channels strip referrers, so this is the only place they can be counted.
  { slug: 'chatgpt', label: 'ChatGPT', class: 'ai_assistant', brandColor: '#10A37F', hasMark: true, aliases: ['openai', 'gpt', 'chat gpt'] },
  { slug: 'claude', label: 'Claude', class: 'ai_assistant', brandColor: '#D97757', hasMark: true, aliases: ['anthropic'] },
  { slug: 'perplexity', label: 'Perplexity', class: 'ai_assistant', brandColor: '#1FB8CD', hasMark: true },
  { slug: 'gemini', label: 'Gemini', class: 'ai_assistant', brandColor: '#8E75B2', hasMark: true, aliases: ['bard', 'google ai'] },

  // --- Search -----------------------------------------------------------------
  { slug: 'google', label: 'Google', class: 'search', brandColor: '#4285F4', hasMark: true, aliases: ['search', 'googled'] },
  { slug: 'bing', label: 'Bing', class: 'search', brandColor: '#174AE4', hasMark: true, aliases: ['microsoft'] },
  { slug: 'duckduckgo', label: 'DuckDuckGo', class: 'search', brandColor: '#DE5833', hasMark: true, aliases: ['ddg'] },

  // --- Podcasts ---------------------------------------------------------------
  // §3.2: people remember the show, not the app, so these expand to a show picker.
  { slug: 'spotify', label: 'A podcast on Spotify', class: 'podcast', brandColor: '#1ED760', hasMark: true, expandsByDefault: true },
  { slug: 'apple-podcasts', label: 'A podcast on Apple Podcasts', class: 'podcast', brandColor: '#9933CC', hasMark: true, expandsByDefault: true },

  // --- Communities ------------------------------------------------------------
  { slug: 'reddit', label: 'Reddit', class: 'community', brandColor: '#FF4500', hasMark: true, expandsByDefault: true, aliases: ['subreddit', 'r/'] },
  { slug: 'hackernews', label: 'Hacker News', class: 'community', brandColor: '#F0652F', hasMark: true, aliases: ['hn', 'ycombinator'] },
  { slug: 'producthunt', label: 'Product Hunt', class: 'community', brandColor: '#DA552F', hasMark: true, aliases: ['ph'] },
  { slug: 'discord', label: 'Discord', class: 'community', brandColor: '#5865F2', hasMark: true, expandsByDefault: true },
  { slug: 'slack', label: 'A Slack community', class: 'community', brandColor: '#4A154B', hasMark: true, expandsByDefault: true },
  { slug: 'github', label: 'GitHub', class: 'community', brandColor: '#181717', hasMark: true },
  { slug: 'substack', label: 'A newsletter on Substack', class: 'community', brandColor: '#FF6719', hasMark: true, expandsByDefault: true },
  { slug: 'medium', label: 'Medium', class: 'community', brandColor: '#000000', hasMark: true },
  { slug: 'quora', label: 'Quora', class: 'community', brandColor: '#B92B27', hasMark: true },
  { slug: 'notion', label: 'Notion', class: 'community', brandColor: '#000000', hasMark: true },

  // --- Messaging --------------------------------------------------------------
  // Dark social. No referrer ever reaches us from any of these.
  { slug: 'whatsapp', label: 'WhatsApp', class: 'messaging', brandColor: '#25D366', hasMark: true },
  { slug: 'telegram', label: 'Telegram', class: 'messaging', brandColor: '#26A5E4', hasMark: true },
  { slug: 'wechat', label: 'WeChat', class: 'messaging', brandColor: '#07C160', hasMark: true, aliases: ['weixin', '微信'] },
  { slug: 'line', label: 'LINE', class: 'messaging', brandColor: '#00C300', hasMark: true },

  // --- No brand behind them ---------------------------------------------------
  // §3.2's fallback: only when there is no brand to name. Labelled the way a person would
  // describe what happened, not as a category.
  //
  // These carry a mark too — a plain line icon, drawn here rather than fetched, since there is
  // no trademark to source. They started with no icon at all, which broke the scan: an eye
  // running down a column of logos hits a blank and has to switch from recognising to reading.
  // That is not only untidy, it biases the answer. Word of mouth is routinely a top-three
  // channel, and a row that is harder to spot gets picked less — the same class of error as
  // the ordering bias §6 spends its guards on, arriving through the artwork instead.
  //
  // Deliberately a tier quieter than the brand marks: monochrome, stroked, lower contrast.
  // They are a different kind of thing and should not compete for the same glance.
  { slug: 'friend', label: 'A friend or colleague told me', class: 'word_of_mouth', brandColor: '#64748B', hasMark: true, aliases: ['word of mouth', 'referral', 'recommendation'] },
  { slug: 'coworker-internal', label: 'Someone at my company was already using it', class: 'word_of_mouth', brandColor: '#64748B', hasMark: true, aliases: ['team', 'internal'] },
  { slug: 'event', label: 'At a conference or event', class: 'offline', brandColor: '#64748B', hasMark: true, expandsByDefault: true, aliases: ['trade show', 'meetup', 'booth'] },
  { slug: 'press', label: 'An article or review', class: 'other', brandColor: '#64748B', hasMark: true, aliases: ['blog', 'news', 'press'] },
  { slug: 'email', label: 'An email from you', class: 'other', brandColor: '#64748B', hasMark: true, aliases: ['newsletter'] },
  { slug: 'ad', label: 'An ad', class: 'other', brandColor: '#64748B', hasMark: true, aliases: ['advertisement', 'sponsored'] },
] as const

const BY_SLUG = new Map(PLATFORMS.map((p) => [p.slug, p]))

export function getPlatform(slug: string): CatalogPlatform | undefined {
  return BY_SLUG.get(slug)
}

/** Public path of a platform's mark, or null when it renders as a monogram. */
export function markUrl(platform: CatalogPlatform): string | null {
  return platform.hasMark ? `/logos/${platform.slug}.svg` : null
}

/**
 * Classes whose entries are named things with an identity to recognize. Everything else
 * is a description of an experience.
 */
const BRANDED_CLASSES = new Set<PlatformClass>([
  'creator',
  'ai_assistant',
  'search',
  'podcast',
  'community',
  'messaging',
])

/**
 * The tile colour for a platform, or null when it should render with no tile at all.
 *
 * Every branded entry gets one, whether or not a mark exists for it. The brand colour goes
 * on the tile and the mark (or the monogram) sits on top in whatever contrasts — the way an
 * app icon works. Colouring the mark itself instead cannot serve both ends of the range:
 * TikTok and X are #000000 and disappear on a dark surface, Snapchat is #FFFC00 and
 * disappears on a light one. Behind the mark, the colour is independent of the theme.
 *
 * Null for the descriptive entries. A tile is worth its space when there is an identity to
 * recognise; on "A friend or colleague told me" it reads as a brand, competes with the real
 * logos for the eye, and makes scanning the list slower rather than faster (§3.2).
 */
export function tileColor(platform: CatalogPlatform): string | null {
  // A mark carries its own colour, so putting the brand colour behind it is wrong twice: a
  // four-colour Google G on a blue square is not Google's logo, and Instagram's gradient on a
  // pink square is the same colour said twice. Official marks sit on a neutral surface, which
  // is what they are designed for.
  //
  // Now that every platform in the catalog has an official mark, this returns null for all of
  // them. It stays because the monogram path is still real — a caller-defined creator with no
  // avatar gets initials on a tile — and because an entry added later without a mark should
  // fall back rather than render blank.
  if (platform.hasMark || !BRANDED_CLASSES.has(platform.class)) {
    return null
  }

  return platform.brandColor
}

/**
 * Monogram text for a candidate with no mark or avatar.
 *
 * Two characters at most: a tile has to be recognizable at the size of an avatar, and
 * three letters at that size is a smudge. Falls back to the first character of the
 * label for anything unusual, which is still better than an empty square — the point
 * of the tile is to give the eye something to land on while scanning (§3.2).
 */
export function monogram(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return '?'
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * A reasonable starting list for a B2B SaaS: everything a first-time caller is likely
 * to actually run, and nothing that would pad the list without ever being picked.
 *
 * Erring toward MORE entries is deliberate (§3.3). A missing channel does not cost one
 * data point — its traffic lands in a neighbouring bucket and books a false entry
 * there, so a short list is worse than a long one. Icons keep a long list scannable.
 */
export const DEFAULT_CHANNEL_SLUGS: readonly string[] = [
  'google',
  'chatgpt',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
  'instagram',
  'reddit',
  'friend',
  'coworker-internal',
  'press',
  'event',
] as const
