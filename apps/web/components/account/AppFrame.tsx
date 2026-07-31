import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Chrome for the two app pages, /signin and /account.
 *
 * Deliberately thinner than the marketing header. Someone here is mid-task with one job
 * to finish, and every extra link out of a two-field flow is a way to lose them before
 * they have a key. "Back to site" stays, because otherwise the only exit from /signin is
 * the browser's back button.
 *
 * Not a layout.tsx: a shared layout would apply to anything added under these routes
 * later and quietly make "the account area" a place with sections. A component that each
 * page imports keeps the surface a list of two pages you can count.
 */

type Props = {
  eyebrow: string
  title: string
  lede: ReactNode
  /** Top-right control — the sign-out button on /account, nothing on /signin. */
  action?: ReactNode
  children: ReactNode
}

export function AppFrame({ eyebrow, title, lede, action, children }: Props) {
  return (
    // /signin and /account are the site, not the embed, so they take the site palette.
    // The respondent page at /s/[id] deliberately does not — its accent is the host's.
    <main data-palette="growth" className="min-h-screen bg-[var(--page-gradient)]">
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)] transition hover:text-stone-900"
          >
            HumanSurvey
          </Link>
          <div className="flex items-center gap-2">
            {action}
            <Link
              href="/"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
            >
              Back to site
            </Link>
          </div>
        </header>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-600">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-[2.1rem] leading-[1.1] tracking-[-0.02em] text-stone-900 sm:text-[2.75rem]">
            {title}
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-stone-700">{lede}</p>
        </div>

        {children}
      </div>
    </main>
  )
}
