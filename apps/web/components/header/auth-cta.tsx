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
  /**
   * The signed-in visitor's dashboard link, resolved server-side by the
   * page rendering this CTA (`auth()` + `resolveActiveProjectPath`, the
   * same rule `[projectId]/layout.tsx` falls back to) — `null` when the
   * server saw no session. Drives both the first paint (before Clerk's
   * client SDK reports its loaded state) and, once loaded, a live
   * signed-in visitor the server didn't know about yet (e.g. a session
   * that started in another tab) — that case falls back to `/new` rather
   * than blocking on a client-side fetch.
   */
  initialDashboardHref: string | null
}

/**
 * The one CTA slot on the landing page: "Continue with Google" for a
 * signed-out visitor, "Dashboard" (linking straight to their project) for
 * a signed-in one. Trusts `initialDashboardHref` for the first paint
 * instead of defaulting to signed-out, so there's never a flash of the
 * wrong action, and once Clerk's client SDK loads, trusts its live
 * signed-in state instead.
 */
export function AuthCta({
  size,
  className,
  iconSize = 15,
  compact = false,
  initialDashboardHref,
}: AuthCtaProps) {
  const { isLoaded, isSignedIn: liveIsSignedIn } = useUser()
  const { signIn } = useSignIn()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const labelClassName = compact ? 'sr-only sm:not-sr-only' : undefined
  const isSignedIn = isLoaded ? liveIsSignedIn : initialDashboardHref !== null

  if (isSignedIn) {
    return (
      <Button asChild size={size} variant="primary" className={className}>
        <Link href={initialDashboardHref ?? '/new'}>
          <LayoutGrid aria-hidden="true" size={iconSize} />
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
        // `/sso-callback` resolves the caller's real project itself and
        // navigates there imperatively — this is the required static
        // fallback, never the URL a visitor actually lands on.
        redirectUrlComplete: '/',
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
