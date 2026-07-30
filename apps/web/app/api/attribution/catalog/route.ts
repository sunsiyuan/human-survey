import { NextResponse } from 'next/server'

import { DEFAULT_CHANNEL_SLUGS, PLATFORMS, markUrl, monogram } from '@/lib/catalog/platforms'

/**
 * The product-owned platform catalog, as data.
 *
 * Unauthenticated on purpose. Configuration is agent-driven (§10.4), and an agent
 * cannot name a `catalog_slug` it has never seen — requiring a key to read the
 * vocabulary would put a credential between the caller and the docs. Nothing here is
 * secret: the marks are already served from /logos and the labels are what every
 * respondent reads.
 *
 * Fields are renamed to snake_case to match the rest of the API surface. `icon_url` is
 * null wherever a brand's mark is absent from simple-icons (LinkedIn, ChatGPT, Slack
 * among them, following trademark requests); `monogram` is what to render in its
 * place, shipped here so a caller does not have to reimplement the two-character rule.
 *
 * `expands_by_default` is advisory. §10.4 has an agent decide monthly which channels
 * earn a follow-up question, based on where the money went — a static flag cannot know
 * that, and `configure` never applies it on the caller's behalf.
 */

export function GET() {
  return NextResponse.json(
    {
      platforms: PLATFORMS.map((platform) => ({
        slug: platform.slug,
        label: platform.label,
        class: platform.class,
        brand_color: platform.brandColor,
        icon_url: markUrl(platform),
        monogram: monogram(platform.label),
        aliases: platform.aliases ?? [],
        expands_by_default: platform.expandsByDefault ?? false,
      })),
      default_channel_slugs: DEFAULT_CHANNEL_SLUGS,
    },
    {
      // The catalog is a checked-in module, so it only ever changes on deploy. Caching
      // it is safe in a way a live catalog would not be: `configure` copies label and
      // mark into the config snapshot (§4), so a stale read here can misinform
      // discovery but can never alter what a stored response says was rendered.
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
    },
  )
}
