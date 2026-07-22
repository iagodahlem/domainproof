'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

/**
 * Google redirects here after the OAuth handshake. Clerk's component
 * finishes the sign-in/sign-up, then sends the browser on to `/dashboard`
 * — which is the single place that decides between the locked
 * create-project screen and the real dashboard, based on the caller's
 * project list (see `app/dashboard/page.tsx`).
 */
export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    />
  )
}
