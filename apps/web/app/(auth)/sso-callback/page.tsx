'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

/**
 * Google redirects here after the OAuth handshake. Clerk's component
 * finishes the sign-in/sign-up, then sends the browser on to `/app` — the
 * single resolver route that lands on the caller's active project (or
 * `/new` if they have none yet).
 */
export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
    />
  )
}
