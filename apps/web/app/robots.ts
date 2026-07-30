import type { MetadataRoute } from 'next'

const BASE = 'https://www.humansurvey.co'

/**
 * The single source for /robots.txt.
 *
 * There used to be two: this route and a checked-in public/robots.txt, with different
 * contents. Only one of them was ever served and the repo could not tell you which,
 * because the answer lives in the host's static-asset-versus-route precedence rather
 * than in this codebase. Both behaviours are merged here and the static file is gone,
 * so the question no longer has to be answered.
 *
 * Two behaviours, and neither is decorative:
 *
 * 1. AI crawlers are welcome. HumanSurvey is bought by people asking an agent how to
 *    find out where their signups come from, so being readable by ClaudeBot and GPTBot
 *    is distribution, not a concession. The named groups are redundant against a `*`
 *    that already allows everything — they exist to say it out loud, since a missing
 *    allowlist gets read as ambivalence.
 *
 * 2. /s/ stays out of the index. Those are respondent forms. They already render
 *    `robots: { index: false }`, but an indexed one would collect answers from
 *    strangers who arrived via a search result, and every one of those spends the
 *    owner's response quota on junk.
 *
 * The two interact in a way the old static file got wrong: a crawler that matches a
 * named user-agent group ignores the `*` group entirely, so a bare `Allow: /` under
 * GPTBot invited it into /s/. Every group repeats the Disallow.
 */
const AI_CRAWLERS = [
  'ClaudeBot',
  'Anthropic-AI',
  'GPTBot',
  'Google-Extended',
  'PerplexityBot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/s/',
      },
      {
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: '/s/',
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
