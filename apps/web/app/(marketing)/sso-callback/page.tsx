'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

/**
 * Google redirects here after the OAuth handshake. Clerk's component
 * finishes the sign-in/sign-up, then sends the browser on to `/active`
 * — a placeholder project segment that `[projectId]/layout.tsx` resolves
 * to the caller's actual project (or `/new` if they have none yet).
 */
export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/active"
      signUpFallbackRedirectUrl="/active"
    />
  )
}
