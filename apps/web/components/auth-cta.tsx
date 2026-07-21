'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSignIn, useUser } from '@clerk/nextjs'
import { Button, type ButtonProps } from '@domainproof/ui'
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

  if (isLoaded && isSignedIn) {
    return (
      <Button asChild size={size} variant="primary" className={className}>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
    )
  }

  async function startGoogleSignIn() {
    if (!signIn) return
    setStarting(true)
    await signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    })
  }

  return (
    <Button
      size={size}
      variant="primary"
      className={className}
      disabled={!isLoaded}
      loading={starting}
      onClick={() => void startGoogleSignIn()}
    >
      <GoogleIcon size={iconSize} />
      Continue with Google
    </Button>
  )
}
