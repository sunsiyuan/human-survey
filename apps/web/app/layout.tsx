import type { Metadata } from 'next'
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google'

import './globals.css'

const sans = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://mts.vercel.app'),
  title: 'Markdown to Survey — Survey infrastructure for AI agents',
  description:
    'Create surveys from Markdown or JSON schema, collect human responses, and retrieve structured results via API or MCP.',
  applicationName: 'Markdown to Survey',
  keywords: [
    'survey api',
    'mcp server',
    'ai agent tools',
    'markdown survey',
    'survey infrastructure',
    'json schema forms',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Markdown to Survey (MTS)',
    description:
      'The survey layer for AI agents. Markdown in, structured human responses out.',
    url: 'https://mts.vercel.app',
    siteName: 'Markdown to Survey',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Markdown to Survey (MTS)',
    description:
      'Survey infrastructure for AI agents. Markdown or JSON schema in, structured results back.',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Markdown to Survey',
  applicationCategory: 'DeveloperApplication',
  description: 'Survey infrastructure for AI agents',
  url: 'https://mts.vercel.app',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`h-full ${sans.variable} ${mono.variable}`}>
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
