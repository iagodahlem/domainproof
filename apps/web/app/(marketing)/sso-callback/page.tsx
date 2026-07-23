'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useClerk } from '@clerk/nextjs'
import { resolveActiveProjectPath } from '@/lib/project-resolution'

/**
 * Required static value for Clerk's `signInFallbackRedirectUrl`/
 * `signUpFallbackRedirectUrl` props — never the URL a visitor actually
 * lands on, see the component doc below.
 */
const FALLBACK_PATH = '/'

/**
 * Google redirects here after the OAuth handshake. Calls Clerk's
 * `handleRedirectCallback` imperatively — the same thing the declarative
 * `<AuthenticateWithRedirectCallback>` component does internally — instead
 * of using that component, so we can pass a `customNavigate` that
 * intercepts where the browser goes next.
 *
 * Clerk still needs a static fallback URL for in-flow steps it might route
 * through first (2FA, email verification, an incomplete sign-up) —
 * `customNavigate` passes those through unchanged. Only once the flow is
 * actually complete, i.e. Clerk itself wants to land on that static
 * fallback, do we resolve the caller's real project (or `/new`, the same
 * rule `[projectId]/layout.tsx` falls back to) and navigate there — so no
 * placeholder segment is ever user-visible.
 */
export default function SsoCallbackPage() {
  const router = useRouter()
  const clerk = useClerk()
  const { getToken } = useAuth()

  useEffect(() => {
    const customNavigate = async (to: string) => {
      const path = new URL(to, window.location.origin).pathname
      if (path !== FALLBACK_PATH) {
        router.replace(to)
        return
      }
      router.replace(await resolveActiveProjectPath(await getToken()))
    }

    void clerk.handleRedirectCallback(
      {
        signInFallbackRedirectUrl: FALLBACK_PATH,
        signUpFallbackRedirectUrl: FALLBACK_PATH,
      },
      customNavigate,
    )
    // Runs once for this callback page's single mount — handleRedirectCallback
    // completes (or fails) the in-flight OAuth attempt exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
