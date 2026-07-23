'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Callout } from '@domainproof/ui'
import type { Verification } from '@/lib/api/frontend'
// This route mounts no QueryProvider (D-029: the hosted verification page
// is anonymous, with no auth/session context) — converting these calls to
// a lib/query hook would mean adding one, a real behavior change rather
// than a structural move, so it's out of scope here (same category of
// deliberate exception as EventsView's loadMore — see
// apps/web/ARCHITECTURE.md).
// eslint-disable-next-line no-restricted-imports -- see note above
import { getVerification, runVerificationCheck } from '@/lib/api/frontend'
import { useBoundedPoll } from '../_lib/use-bounded-poll'
import { describeStatus } from '../_lib/status-view'
import { verificationSteps } from '../_lib/verification-steps'
import { AgentReveal } from './agent-reveal'
import { CloudflareFastpathCard } from './cloudflare-fastpath-card'
import { ExpiredLinkCard } from './expired-link-card'
import { OutcomeCard } from './outcome-card'
import { RecordCardSection } from './record-card-section'
import { VerificationProgress } from './verification-progress'
import { VerifyHeader } from './verify-header'

/** No further status change is possible without external action this page can't take on its own (a project regenerating the challenge) — polling stops here. */
const TERMINAL_STATUSES = new Set<Verification['status']>([
  'verified',
  'failed',
])

export interface VerificationPageClientProps {
  token: string
  initialData: Verification
  /** The `?cloudflare=` outcome from the one-click callback redirect, if this load is one. */
  cloudflareOutcome: string | null
}

export function VerificationPageClient({
  token,
  initialData,
  cloudflareOutcome,
}: VerificationPageClientProps) {
  const [data, setData] = useState(initialData)
  const [pollError, setPollError] = useState<string | null>(null)
  const triggeredOptimisticRecheck = useRef(false)

  const poll = useCallback(async () => {
    const result = await getVerification(token)
    if (result.ok) {
      setData(result.data)
      setPollError(null)
    } else if (result.error.kind === 'network') {
      setPollError(
        "We're having trouble reaching DomainProof — we'll keep trying.",
      )
    }
    // An http error here (e.g. a 404 for a claim released mid-session) is
    // left alone rather than tearing down an otherwise-working page out
    // from under a live background poll.
  }, [token])

  const { isPolling } = useBoundedPoll(
    poll,
    !TERMINAL_STATUSES.has(data.status),
  )

  // A successful Cloudflare one-click setup writes the record
  // server-side and triggers a verify there too, but this page's own view
  // of `data` is still whatever the initial SSR fetch saw *before* that —
  // force one immediate check so the optimistic "checking now…" callout
  // resolves quickly instead of waiting for the poll's first backoff rung.
  // Gated on the *initial* fetch already being verified: `cloudflareOutcome`
  // comes from the URL and survives a plain page reload, so without this
  // guard, reloading a since-verified page would fire another check (and
  // log another event) for no reason — there's nothing left to optimistically
  // resolve.
  useEffect(() => {
    if (
      cloudflareOutcome !== 'success' ||
      triggeredOptimisticRecheck.current ||
      initialData.status === 'verified'
    ) {
      return
    }
    triggeredOptimisticRecheck.current = true
    void runVerificationCheck(token).then((result) => {
      if (result.ok) setData(result.data)
    })
  }, [cloudflareOutcome, initialData.status, token])

  const view = describeStatus({
    status: data.status,
    check: data.check,
    domain: data.domain,
    projectName: data.projectName,
  })

  // Expired and invalid links get the same treatment: there's no live claim
  // left to anchor a context header or stepper to, so both stay a single
  // centered card rather than showing "record added" progress for a link
  // that can no longer progress. An invalid token never reaches this
  // component at all (page.tsx 404s it before render).
  if (data.status === 'failed' && data.check?.outcome === 'expired') {
    return <ExpiredLinkCard projectName={data.projectName} />
  }

  const outcomeTone = view.tone === 'pending' ? null : view.tone
  const showTaskArea = view.showRecheck
  const showCloudflareFastpath = showTaskArea && data.provider === 'cloudflare'

  return (
    <main className="mx-auto flex max-w-140 flex-col gap-8 px-6 pb-12 max-[480px]:gap-6 max-[480px]:px-4 max-[480px]:pb-8">
      <VerifyHeader
        domain={data.domain}
        projectName={data.projectName}
        verified={data.status === 'verified'}
      />

      <div className="flex flex-col gap-6">
        <VerificationProgress
          steps={verificationSteps({ status: data.status, check: data.check })}
          tone={view.tone}
          badgeLabel={view.badgeLabel}
          meta={isPolling ? 'Checking automatically, every 20s.' : null}
          unreachableNote={view.unreachableNote}
        />

        {pollError ? <Callout tone="warning">{pollError}</Callout> : null}

        {outcomeTone ? (
          <OutcomeCard
            tone={outcomeTone}
            heading={view.heading}
            body={view.body}
            check={view.showDiff ? data.check : null}
          />
        ) : null}

        {showTaskArea ? (
          <>
            {showCloudflareFastpath ? (
              <>
                <CloudflareFastpathCard
                  token={token}
                  domain={data.domain}
                  cloudflareOutcome={cloudflareOutcome}
                />
                <div className="flex items-center gap-3 text-xs text-faint-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or add it yourself
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            ) : null}
            <RecordCardSection domain={data.domain} records={data.records} />
            <AgentReveal domain={data.domain} records={data.records} />
          </>
        ) : null}
      </div>

      <p className="text-center text-xs text-faint-foreground">
        Secured by DomainProof
      </p>
    </main>
  )
}
