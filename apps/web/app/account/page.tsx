import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { AppFrame } from '@/components/account/AppFrame'
import { Keys } from '@/components/account/Keys'
import { SignOutButton } from '@/components/account/SignOutButton'
import { resolveSession, SESSION_COOKIE } from '@/lib/auth'
import { sql } from '@/lib/db'

/**
 * The account area: accounts, keys, and later billing. Nothing else.
 *
 * That boundary is a product decision (docs/design/attribution-pivot.md §10.1), and it is
 * load-bearing rather than tidy. Results are an API/MCP resource because the agent is the
 * reader; the homepage promises there is nothing to log in and browse. A results tab here
 * would not be a feature, it would be the first half of the dashboard this product exists
 * to not be — and the second half arrives on its own, because a chart always wants a
 * filter and a filter always wants a candidate editor.
 *
 * You sign in to get a key. Then you leave.
 *
 * noindex for the same reason as /signin: app surface, not content. Both are also absent
 * from app/sitemap.ts, which enumerates its URLs by hand.
 */
export const metadata: Metadata = {
  title: 'Account — HumanSurvey',
  robots: { index: false, follow: false },
  // Root metadata sets canonical '/' and children inherit it, which would have this page
  // claim the homepage as its canonical URL. Null emits no link.
  alternates: { canonical: null },
}

export default async function AccountPage() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value
  const accountId = await resolveSession(session)

  if (!accountId) {
    // A redirect, not a 401 page. Arriving here signed out is the normal way in — a
    // bookmark, an expired thirty-day session, a link from the docs — and the only useful
    // response to it is the form that fixes it.
    redirect('/signin')
  }

  const rows = (await sql`
    SELECT email FROM accounts WHERE id = ${accountId} LIMIT 1
  `) as Array<{ email: string }>

  const email = rows[0]?.email

  if (!email) {
    // The session resolved to an account that no longer exists. Rare, but the alternative
    // to handling it is a page rendering "undefined" as the signed-in address.
    redirect('/signin')
  }

  return (
    <AppFrame
      eyebrow="Account"
      title="Your keys."
      lede={
        <>
          Signed in as <strong className="font-medium text-stone-900">{email}</strong>. This
          page is keys and, later, billing — the forms, the candidate lists and the answers
          all live behind the{' '}
          <a
            href="/docs"
            className="text-[var(--accent-strong)] underline decoration-dotted underline-offset-4 hover:text-stone-900"
          >
            API
          </a>
          , where your agent reads them. There is nothing here to browse, by design.
        </>
      }
      action={<SignOutButton />}
    >
      <Keys />

      <footer className="border-t border-[var(--panel-border)] pt-6 text-[13px] leading-6 text-stone-600">
        <p>
          A key never expires and is never shown twice. Revoke one from this page — any key
          on the account can be killed from here, which is the point of the page existing at
          all: a leaked key does not need the leaked key to retire it.
        </p>
        <p className="mt-3">
          Rather not use a browser at all? Your agent can run the MCP server&apos;s{' '}
          <code className="font-mono text-[12px] text-stone-700">login</code> tool: same
          six-digit code, and the key it gets back is written to a file on your machine
          instead of into a conversation.{' '}
          <a
            href="/docs#authentication"
            className="text-[var(--accent-strong)] underline decoration-dotted underline-offset-4 hover:text-stone-900"
          >
            Both paths, in full
          </a>
          .
        </p>
      </footer>
    </AppFrame>
  )
}
