import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT'],
  weight: 'variable',
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
  title: 'HumanSurvey — find out where your signups actually come from',
  description:
    'Self-reported attribution for the channels that send no referrer. Ask people how they heard about you inside your own signup or payment flow, down to which creator, and read the answers back over the API.',
  applicationName: 'HumanSurvey',
  keywords: [
    'self-reported attribution',
    'how did you hear about us',
    'attribution api',
    'direct traffic attribution',
    'creator attribution',
    'dark social',
    'mcp server',
  ],
  alternates: {
    canonical: '/',
    types: { 'text/markdown': '/index.md' },
  },
  openGraph: {
    title: 'HumanSurvey — find out where your signups actually come from',
    description:
      'The channels with no referrer, measured by asking the person — down to which account, not just which platform.',
    url: 'https://www.humansurvey.co',
    siteName: 'HumanSurvey',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HumanSurvey — find out where your signups actually come from',
    description:
      'Self-reported attribution at creator granularity, embedded in your signup and payment flows, read back over the API.',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      // isPartOf on every page pointed at #org, but schema.org expects a CreativeWork there —
      // "this page is part of an organization" is a triple the vocabulary does not define. The
      // thing pages are part of is the site, so the site has to exist as an entity.
      '@type': 'WebSite',
      '@id': 'https://www.humansurvey.co/#site',
      url: 'https://www.humansurvey.co',
      name: 'HumanSurvey',
      publisher: { '@id': 'https://www.humansurvey.co/#org' },
      inLanguage: 'en',
    },
    {
      '@type': 'Organization',
      '@id': 'https://www.humansurvey.co/#org',
      name: 'HumanSurvey',
      url: 'https://www.humansurvey.co',
      // Was /favicon.ico, which 404s: that file was deleted when the brand mark shipped, and
      // .ico is not a format logo consumers accept anyway. Both surviving marks are real
      // routes (verified 200 against a production build), and this is the raster one —
      // /icon.svg resolves too, but SVG is rejected by most logo consumers.
      logo: 'https://www.humansurvey.co/apple-icon.png',
      foundingDate: '2026-03',
      description:
        'Open-source self-reported attribution infrastructure: the channels that send no referrer, measured by asking the person.',
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
      description:
        'Self-reported attribution at creator granularity, configured and read by agents over an API',
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
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}

        {/*
          Page-level analytics for this marketing site: which pages get read, from where.
          Deliberately only that.

          Worth naming the irony, since somebody will notice it: this product exists because
          page analytics CANNOT see the channels that matter — an arrival from TikTok in-app,
          a Slack group or ChatGPT lands in Direct with no referrer, which is the whole premise
          on the page above. Vercel Analytics is not a contradiction of that; it is the half of
          the picture it can actually measure, and this site should be honest about needing the
          other half too. The other half is our own form, on our own signup, once there is one.
        */}
        <Analytics />
      </body>
    </html>
  )
}
