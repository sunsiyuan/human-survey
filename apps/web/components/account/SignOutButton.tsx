'use client'

import { useState } from 'react'

/**
 * POST, never a link. GET sign-out URLs get followed by prefetchers and mail scanners on
 * their own, and the symptom is people being signed out at random — see the route.
 *
 * Navigates to /signin on any answer, success or failure. The cookie is cleared on both
 * (the route clears it even when the row survives), so staying put would leave a page
 * whose every fetch now 401s.
 */
export function SignOutButton() {
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)

    try {
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      // A network failure means the session row may still be there. Going to /signin is
      // still right: whatever happened, this browser is done with the cookie.
    }

    window.location.assign('/signin')
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void signOut()}
      className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900 disabled:opacity-55"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
