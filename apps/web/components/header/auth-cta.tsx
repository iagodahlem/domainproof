'use client'

import { useState } from 'react'
import { useSignIn, useUser } from '@clerk/nextjs'
import { isClerkAPIResponseError } from '@clerk/nextjs/errors'
import { Button, Callout, cn, type ButtonProps } from '@domainproof/ui'
import { GoogleIcon } from './google-icon'

export interface AuthCtaProps extends Pick<ButtonProps, 'size' | 'className'> {
  iconSize?: number
}

// The dashboard world (Clerk's callback + every protected route) lives on
// its own host — see apps/web/middleware.ts — so this landing-page CTA
// always points there absolutely, not at a same-origin relative path.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * The one CTA slot on the landing page: "Continue with Google" for a
 * signed-out visitor, "Dashboard" for a signed-in one. Renders the
 * signed-out shape (disabled) until Clerk reports its loaded state, so
 * there's never a flash of the wrong action.
 */
export function AuthCta({ size, className, iconSize = 15 }: AuthCtaProps) {
  const { isLoaded, isSignedIn } = useUser()
  const { signIn } = useSignIn()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | undefined>()

  if (isLoaded && isSignedIn) {
    return (
      <Button asChild size={size} variant="primary" className={className}>
        <a href={new URL('/dashboard', APP_URL).toString()}>Dashboard</a>
      </Button>
    )
  }

  async function startGoogleSignIn() {
    if (!signIn) return
    setError(undefined)
    setStarting(true)
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: new URL('/sso-callback', APP_URL).toString(),
        redirectUrlComplete: new URL('/dashboard', APP_URL).toString(),
      })
    } catch (err) {
      setStarting(false)
      setError(
        isClerkAPIResponseError(err)
          ? (err.errors[0]?.longMessage ??
              err.errors[0]?.message ??
              'Something went wrong. Please try again.')
          : 'Something went wrong. Please try again.',
      )
    }
  }

  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      <Button
        size={size}
        variant="primary"
        disabled={!isLoaded}
        loading={starting}
        onClick={() => void startGoogleSignIn()}
      >
        <GoogleIcon size={iconSize} />
        Continue with Google
      </Button>
      {error ? (
        <Callout tone="warning" className="max-w-[38ch] p-3 text-xs">
          {error}
        </Callout>
      ) : null}
    </div>
  )
}
