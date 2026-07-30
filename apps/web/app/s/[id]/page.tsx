import type { Metadata } from 'next'
import { nanoid } from 'nanoid'
import { notFound } from 'next/navigation'

import { AttributionForm } from '@/components/attribution/AttributionForm'
import { mountingScript } from '@/components/attribution/useEmbedBridge'
import { parseAttributionConfig, type AskNode } from '@/lib/attribution/schema'
import { parseJsonValue, sql } from '@/lib/db'
import { extractTagsFromSearchParams } from '@/lib/metadata'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Never cached. The render_id minted below is the rotation seed, so a cached page would
 * hand every respondent the same permutation — which does not error, does not look
 * wrong, and quietly turns `rotate` back into `fixed` along with every claim §6.1 makes
 * about it being unbiased by construction.
 */
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type Theme = {
  accent?: string
  radius?: number
  font?: string
  dark_mode?: 'light' | 'dark' | 'auto'
}

/**
 * The only page a respondent ever sees.
 *
 * Reads Postgres directly rather than fetching its own API. That makes it a second
 * consumer of the schema shape with no contract between them, which is a real cost —
 * but the alternative is an HTTP round trip to ourselves on the critical path of a form
 * embedded in someone's checkout, and this page renders nothing the public API does not
 * already expose.
 */
export default async function RespondPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams
  const embedded = query.embed === '1'

  // Non-reserved params become response metadata, so the host can segment by whatever
  // they already know (?plan=pro&step=checkout). Reserved ones drive this page and are
  // filtered out — see RESERVED_QUERY_PARAMS.
  const tags = extractTagsFromSearchParams(query)
  const externalId = typeof query.external_id === 'string' ? query.external_id : null
  // Minted here rather than in the client component. It seeds the order of the first
  // paint, so a value generated during hydration would differ from the one used for SSR
  // and React would discard the server HTML — see AttributionForm's `renderId` prop.
  const renderId = nanoid(16)
  const hostOrigin = typeof query.host_origin === 'string' ? query.host_origin : null

  const rows = (await sql`
    SELECT
      f.id,
      f.name,
      f.status,
      f.theme,
      c.version,
      c.nodes,
      c.root_node_id
    FROM attribution_forms f
    LEFT JOIN attribution_configs c
      ON c.form_id = f.id AND c.version = f.current_version
    WHERE f.id = ${id}
    LIMIT 1
  `) as Array<{
    id: string
    name: string
    status: string
    theme: unknown
    version: number | null
    nodes: unknown
    root_node_id: string | null
  }>

  const form = rows[0]

  if (!form) {
    notFound()
  }

  const shell = embedded ? (
    <script dangerouslySetInnerHTML={{ __html: mountingScript(form.id) }} />
  ) : null

  // A form with no config version was created but never configured. Publicly this is
  // indistinguishable from "not accepting responses", and deliberately so: the fix is
  // the owner's to make, and a respondent cannot act on the difference.
  if (form.status !== 'active' || form.version === null || form.root_node_id === null) {
    return (
      <>
        {shell}
        <Frame embedded={embedded} theme={{}}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This form isn&rsquo;t accepting responses right now.
          </p>
        </Frame>
      </>
    )
  }

  // The stored snapshot went through this same validator on the way in, so a failure
  // here means the row was written by something other than `configure` — better to 404
  // than to render a half-formed question to a respondent.
  let rootNode: AskNode

  try {
    const config = parseAttributionConfig({
      nodes: parseJsonValue(form.nodes),
      root_node_id: form.root_node_id,
    })

    rootNode = config.nodes.find((node) => node.id === config.root_node_id) as AskNode
  } catch {
    notFound()
  }

  const theme = (parseJsonValue<Theme>(form.theme) ?? {}) as Theme

  return (
    <>
      {shell}
      <Frame embedded={embedded} theme={theme}>
        <AttributionForm
          formId={form.id}
          configVersion={form.version}
          renderId={renderId}
          rootNode={rootNode}
          embedded={embedded}
          externalId={externalId}
          hostOrigin={hostOrigin}
          metadata={tags}
        />
      </Frame>
    </>
  )
}

/**
 * Theme tokens (§3.9) — a bounded set of four, applied as CSS custom properties. Not a
 * theme editor: the point is that a form embedded in someone else's payment flow which
 * looks foreign costs completion rate directly, and four parameters buy most of the fix.
 */
function Frame({
  embedded,
  theme,
  children,
}: {
  embedded: boolean
  theme: Theme
  children: React.ReactNode
}) {
  const style: React.CSSProperties & Record<string, string | number | undefined> = {
    '--accent': theme.accent,
    '--radius': theme.radius === undefined ? undefined : `${theme.radius}px`,
    fontFamily: theme.font,
  }

  const mode = theme.dark_mode ?? 'light'

  return (
    <div
      // `dark:` variants are bound to [data-theme="dark"] rather than to the OS
      // preference (app/globals.css), so the host's declared token decides — otherwise a
      // light-themed checkout would render a dark form for anyone whose laptop is in
      // dark mode.
      data-theme={mode === 'auto' ? undefined : mode}
      style={style}
      className={
        embedded
          ? 'bg-transparent'
          : 'flex min-h-screen items-start justify-center bg-[var(--page-gradient)] px-5 py-16'
      }
    >
      {mode === 'auto' ? (
        // Stamped before paint rather than in an effect. Doing it after hydration means
        // a visible flash of the wrong theme inside an iframe the host has already sized.
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var e=document.currentScript.parentElement;e.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(_){}})()`,
          }}
        />
      ) : null}
      {children}
    </div>
  )
}
