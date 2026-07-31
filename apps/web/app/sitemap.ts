import type { MetadataRoute } from 'next'
import { execSync } from 'node:child_process'

const BASE = 'https://www.humansurvey.co'

// Used when `git log` is unavailable (e.g. shallow clone on Vercel that
// doesn't reach the file's last commit). Bump when content broadly changes.
const FALLBACK = new Date('2026-07-30T00:00:00Z')

function lastModified(sourcePath: string): Date {
  try {
    const iso = execSync(
      `git log -1 --format=%cI -- ${JSON.stringify(sourcePath)}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()
    if (iso) return new Date(iso)
  } catch {}
  return FALLBACK
}

type Entry = {
  path: string
  source: string
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

const ROUTES: Entry[] = [
  { path: '', source: 'app/page.tsx', changeFrequency: 'weekly', priority: 1 },
  { path: '/docs', source: 'app/docs/page.tsx', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/faq', source: 'app/faq/page.tsx', changeFrequency: 'weekly', priority: 0.85 },
  // The brand hub: the page a model parses once to learn what this product is. Monthly,
  // not weekly — it restates settled facts, so a high change frequency would be a lie.
  { path: '/about', source: 'app/about/page.tsx', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases', source: 'app/use-cases/page.tsx', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/use-cases/ai-assistants', source: 'app/use-cases/ai-assistants/page.tsx', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/community-feedback', source: 'app/use-cases/community-feedback/page.tsx', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/product-launch', source: 'app/use-cases/product-launch/page.tsx', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/events', source: 'app/use-cases/events/page.tsx', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/changelog', source: 'app/changelog/page.tsx', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/llms.txt', source: 'public/llms.txt', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/llms-full.txt', source: 'public/llms-full.txt', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/index.md', source: 'public/index.md', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/docs.md', source: 'public/docs.md', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/about.md', source: 'public/about.md', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/faq.md', source: 'public/faq.md', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/changelog.md', source: 'public/changelog.md', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/use-cases.md', source: 'public/use-cases.md', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/use-cases/ai-assistants.md', source: 'public/use-cases/ai-assistants.md', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/use-cases/community-feedback.md', source: 'public/use-cases/community-feedback.md', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/use-cases/product-launch.md', source: 'public/use-cases/product-launch.md', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/use-cases/events.md', source: 'public/use-cases/events.md', changeFrequency: 'monthly', priority: 0.6 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, source, changeFrequency, priority }) => ({
    url: `${BASE}${path}`,
    lastModified: lastModified(source),
    changeFrequency,
    priority,
  }))
}
