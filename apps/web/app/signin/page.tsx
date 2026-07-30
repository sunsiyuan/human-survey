import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { AppFrame } from '@/components/account/AppFrame'
import { SignInFlow } from '@/components/account/SignInFlow'
import { resolveSession, SESSION_COOKIE } from '@/lib/auth'

/**
 * The first step of the funnel, and until now the missing one: five surfaces told the
 * buyer to sign in and copy a key, and there was no page to do it on.
 *
 * noindex because this is app surface, not content. It says nothing a search result
 * should carry, and an indexed sign-in page competes with the pages that do the selling.
 * It is also absent from app/sitemap.ts, which lists its URLs explicitly — nothing to
 * remove there, and nothing to add.
 */
export const metadata: Metadata = {
  title: 'Sign in — HumanSurvey',
  robots: { index: false, follow: false },
  // The root layout sets canonical '/', and metadata is inherited, so without this the
  // page would advertise the homepage as its canonical URL. Null emits no link at all,
  // which is the honest answer for a page that should not be in an index either way.
  alternates: { canonical: null },
}

export default async function SignInPage() {
  // Already signed in? Then this page has nothing to offer. Making someone mail
  // themselves a code to reach a session they already hold is pure friction, and the
  // header link that lands here has no way to know which state they are in.
  const session = (await cookies()).get(SESSION_COOKIE)?.value

  if (await resolveSession(session)) {
    redirect('/account')
  }

  return (
    <AppFrame
      eyebrow="Sign in"
      title="Sign in to get a key."
      lede={
        <>
          Signing in and signing up are the same act — there is no separate registration,
          and no password. You give an address, we mail six digits, and a first-time
          address gets an account the moment the code checks out.
        </>
      }
    >
      <SignInFlow />

      <p className="text-[13px] leading-6 text-slate-600">
        What is behind this page is your keys, and nothing else. Forms, candidate lists and
        answers are read and written over the{' '}
        <a
          href="/docs"
          className="text-[var(--accent-strong)] underline decoration-dotted underline-offset-4 hover:text-slate-900"
        >
          API
        </a>{' '}
        by your agent — there is still nothing here to log in and browse.
      </p>
    </AppFrame>
  )
}
