import type { Metadata } from 'next'
import { IBM_Plex_Mono, Inter, Instrument_Serif } from 'next/font/google'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.humansurvey.co'),
  title: 'HumanSurvey — Feedback collection for AI agents',
  description:
    'AI agents create surveys from JSON schema, collect structured feedback from groups of people, and retrieve machine-usable results via API or MCP.',
  applicationName: 'HumanSurvey',
  keywords: [
    'survey api',
    'mcp server',
    'ai agent tools',
    'feedback collection',
    'survey infrastructure',
    'json schema forms',
    'agent feedback',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'HumanSurvey — Feedback collection for AI agents',
    description:
      'Agents create surveys, groups of humans respond, agents get structured results back.',
    url: 'https://www.humansurvey.co',
    siteName: 'HumanSurvey',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HumanSurvey — Feedback collection for AI agents',
    description:
      'Agents create surveys from JSON schema, collect group feedback, retrieve structured results via API or MCP.',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.humansurvey.co/#org',
      name: 'HumanSurvey',
      url: 'https://www.humansurvey.co',
      logo: 'https://www.humansurvey.co/favicon.ico',
      foundingDate: '2026-03',
      description:
        'Open-source feedback collection infrastructure for AI agents.',
      sameAs: [
        'https://github.com/sunsiyuan/human-survey',
        'https://www.npmjs.com/package/humansurvey-mcp',
        'https://glama.ai/mcp/servers/sunsiyuan/human-survey',
      ],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://www.humansurvey.co/#app',
      name: 'HumanSurvey',
      applicationCategory: 'DeveloperApplication',
      description: 'Feedback collection infrastructure for AI agents',
      url: 'https://www.humansurvey.co',
      operatingSystem: 'Web',
      publisher: { '@id': 'https://www.humansurvey.co/#org' },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} ${plexMono.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  )
}
