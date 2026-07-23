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
  /** Hides the label below the `sm` breakpoint, leaving only the icon — for the marketing header's actions cluster, where the toggle beside it does the same so the pair stays on one row down to the smallest screens. The label stays in the DOM as `sr-only`, so the accessible name is unaffected. */
  compact?: boolean
  /** Auth state resolved server-side (`auth()`) by the page rendering this CTA. Drives the first paint so a signed-in visitor sees "Dashboard" immediately instead of a flash of "Continue with Google" while Clerk's client SDK loads. */
  initialIsSignedIn: boolean
  /** Button variant to render as. Defaults to `primary`, the marketing header's loud CTA look; callers with their own quieter chrome (e.g. the docs header's plain bordered button) override it to match. */
  variant?: ButtonProps['variant']
  /** Whether to render the leading icon (dashboard glyph / Google logo) beside the label. Defaults to true; set false where the surrounding button never had an icon and must stay pixel-identical. */
  showIcon?: boolean
}

/**
 * The one CTA slot on the landing page: "Continue with Google" for a
 * signed-out visitor, "Dashboard" (linking to `/app`, the single resolver
 * route that lands on the caller's active project) for a signed-in one.
 * Trusts `initialIsSignedIn` for the first paint instead of defaulting to
 * signed-out, so there's never a flash of the wrong action, and once
 * Clerk's client SDK loads, trusts its live signed-in state instead.
 */
export function AuthCta({
  size,
  className,
  iconSize = 15,
  compact = false,
  initialIsSignedIn,
  variant = 'primary',
  showIcon = true,
}: AuthCtaProps) {
  const { isLoaded, isSignedIn: liveIsSignedIn } = useUser()
  const { signIn } = useSignIn()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const labelClassName = compact ? 'sr-only sm:not-sr-only' : undefined
  const isSignedIn = isLoaded ? liveIsSignedIn : initialIsSignedIn

  if (isSignedIn) {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link href="/app">
          {showIcon ? <LayoutGrid aria-hidden="true" size={iconSize} /> : null}
          <span className={labelClassName}>Dashboard</span>
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
        redirectUrlComplete: '/app',
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
        variant={variant}
        disabled={!isLoaded}
        loading={starting}
        onClick={() => void startGoogleSignIn()}
      >
        {showIcon ? <GoogleIcon size={iconSize} /> : null}
        <span className={labelClassName}>Continue with Google</span>
      </Button>
      {error ? (
        <Callout tone="warning" className="max-w-[38ch] p-3 text-xs">
          {error}
        </Callout>
      ) : null}
    </div>
  )
}
