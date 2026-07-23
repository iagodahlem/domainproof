'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DomainVerification } from '@domainproof/react'
import '@domainproof/react/styles.css'
import { Button, Callout } from '@domainproof/ui'
import { useTheme } from '@domainproof/ui'
import { useCreateComponentSession } from '@/lib/query/component-sessions'
import { LiveBadge } from './live-badge'
import { WALKTHROUGH_SURFACE_MAX_WIDTH } from './onboarding-constants'

export interface LiveComponentPreviewProps {
  projectId: string
}

/**
 * Same default/override as `lib/api/frontend.ts`'s `frontendApiBaseUrl` —
 * duplicated rather than imported, since that module lives under
 * `lib/api/*` (fetch-calling code only client components reach through a
 * `lib/query/*` hook) and this is a plain config value, not a fetch.
 */
function frontendApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_FRONTEND_API_URL ?? 'http://localhost:3001'
}

/**
 * The Components tab's live preview: the actual `@domainproof/react`
 * `<DomainVerification />`, wired to a real, single-use component session
 * minted server-side (`useCreateComponentSession`) — not a mock. This is
 * true dogfooding: the exact same component (talking to the exact same
 * backend) an integrator's own end users would see, so a builder can try
 * the real claim → record → verify loop before ever installing the
 * package. Mints a fresh session each time this step mounts — a session is
 * single-use, so a stale one from a previous visit wouldn't work anyway.
 */
export function LiveComponentPreview({ projectId }: LiveComponentPreviewProps) {
  const { theme } = useTheme()
  const router = useRouter()
  const notifiedRef = useRef(false)
  const {
    mutate: mintSession,
    data: session,
    error,
    isPending,
  } = useCreateComponentSession(projectId)

  useEffect(() => {
    mintSession()
    // Mint once on mount only — re-runs would spend a fresh session on
    // every unrelated re-render, and this step remounts (and mints again)
    // whenever the Components tab itself is re-shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`flex flex-col gap-3 ${WALKTHROUGH_SURFACE_MAX_WIDTH}`}>
      <LiveBadge />
      {error ? (
        <Callout tone="warning" className="flex flex-col items-start gap-3">
          <span>Couldn&rsquo;t start a live session. Please try again.</span>
          <Button variant="default" size="sm" onClick={() => mintSession()}>
            Try again
          </Button>
        </Callout>
      ) : !session || isPending ? (
        <div
          aria-hidden="true"
          className="h-64 w-full animate-pulse rounded-lg border border-border bg-surface-2"
        />
      ) : (
        <DomainVerification
          sessionToken={session.sessionToken}
          baseUrl={frontendApiBaseUrl()}
          theme={theme}
          onVerified={() => {
            if (!notifiedRef.current) {
              notifiedRef.current = true
              router.refresh()
            }
          }}
        />
      )}
    </div>
  )
}
