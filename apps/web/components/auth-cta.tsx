'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSignIn, useUser } from '@clerk/nextjs'
import { isClerkAPIResponseError } from '@clerk/nextjs/errors'
import { LayoutGrid } from 'lucide-react'
import { Button, Callout, cn, type ButtonProps } from '@domainproof/ui'
import { GoogleIcon } from './google-icon'

export interface AuthCtaProps extends Pick<ButtonProps, 'size' | 'className'> {
  iconSize?: number
}

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
        <Link href="/dashboard">
          <LayoutGrid aria-hidden="true" size={iconSize} />
          Dashboard
        </Link>
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
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard',
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
