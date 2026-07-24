'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Verification } from '@domainproof/react'
import type { Grade } from '../_lib/grade'
import type { CheckResult } from '../_lib/types'
import { ScanForm } from './scan-form'
import { ScanningState } from './scanning-state'
import { UnreachableState } from './unreachable-state'
import { SiteNav } from './site-chrome'
import { ReportView } from './report-view'

interface ScanSuccess {
  scanId: string
  domain: string
  grade: Grade
  gradeLabel: string
  teaser: CheckResult[]
}

interface ApiErrorBody {
  error: { code: string; message: string; reasons?: string[] }
}

interface ClaimSuccess {
  domainId: string
  domain: string
  hostedUrl: string
  frontendToken: string | null
  sessionToken: string | null
}

interface StatusResponse {
  claimed: boolean
  verified: boolean
  verifiedAt?: string | null
  fullReport: CheckResult[] | null
  /**
   * The claim's current token/link, present on every poll once claimed —
   * kept in sync with `claim` below so that if the domain went dead (its
   * owner deleted it) and got reclaimed fresh server-side, the embedded
   * widget rebinds to the new live claim instead of staying stuck on one
   * that 404s forever. Not necessarily from *this* poll's own reclaim: a
   * concurrent poll can just as easily be the one that lands after the
   * store's already updated.
   */
  frontendToken?: string | null
  hostedUrl?: string | null
}

type Phase = 'idle' | 'scanning' | 'unreachable' | 'report'

const MIN_SCAN_DISPLAY_MS = 900
const STATUS_POLL_INTERVAL_MS = 5000
const STATUS_POLL_MAX_ATTEMPTS = 40
/**
 * Cadence once `STATUS_POLL_MAX_ATTEMPTS` ticks at the normal interval have
 * fired. Real DNS propagation can easily outlast that window, so this poll
 * never stops on its own while the claim is still pending — it only slows
 * down. `status?.verified` turning `true` is what actually ends it (see the
 * effect below).
 */
const STATUS_POLL_LONG_TAIL_INTERVAL_MS = 60_000

export function SitegradeApp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // True only across the mount-time restore fetch below (a `?scan=` param
  // was present at mount) — keeps the empty form from flashing before the
  // restored report takes over, or before a stale param is cleared.
  const [restoring, setRestoring] = useState(
    () => searchParams.get('scan') !== null,
  )
  const [phase, setPhase] = useState<Phase>('idle')
  const [domainInput, setDomainInput] = useState('')
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null)
  const [scanning, setScanning] = useState<{ domain: string } | null>(null)
  const [scanResult, setScanResult] = useState<ScanSuccess | null>(null)
  const [unreachable, setUnreachable] = useState<{
    domain: string
    reasons: string[]
  } | null>(null)

  const [claim, setClaim] = useState<ClaimSuccess | null>(null)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [widgetVerifiedDomain, setWidgetVerifiedDomain] = useState<
    string | null
  >(null)

  const claimRequestedForScanId = useRef<string | null>(null)

  const runScan = useCallback(
    async (domain: string) => {
      setScanErrorMessage(null)
      setScanning({ domain })
      setPhase('scanning')
      const startedAt = Date.now()

      let response: Response
      try {
        response = await fetch('/demo/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain }),
        })
      } catch {
        setPhase('idle')
        setScanErrorMessage(
          "Couldn't reach Sitegrade — check your connection and try again.",
        )
        return
      }

      const elapsed = Date.now() - startedAt
      if (elapsed < MIN_SCAN_DISPLAY_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_SCAN_DISPLAY_MS - elapsed),
        )
      }

      if (response.status === 422) {
        const body = (await response.json()) as ApiErrorBody
        setUnreachable({
          domain,
          reasons: body.error.reasons ?? [body.error.message],
        })
        setPhase('unreachable')
        return
      }

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ApiErrorBody | null
        setPhase('idle')
        setScanErrorMessage(
          body?.error.message ?? 'Something went wrong — try again.',
        )
        return
      }

      const data = (await response.json()) as ScanSuccess
      setScanResult(data)
      setClaim(null)
      setStatus(null)
      setWidgetVerifiedDomain(null)
      claimRequestedForScanId.current = null
      setPhase('report')
      // Pins the report to the URL so a refresh can restore it (see the
      // mount-time restore effect below) instead of losing it back to the
      // empty form — this state otherwise lives only in memory. `domain`
      // rides along too: it's the recovery hint the scan-restore fetch (and,
      // once claimed, the status poll) needs to rehydrate server-side state
      // that a restart or a different serverless instance lost — see
      // status/route.ts and scan/route.ts's own doc comments.
      router.replace(
        `/demo?scan=${encodeURIComponent(data.scanId)}&domain=${encodeURIComponent(data.domain)}`,
        { scroll: false },
      )
    },
    [router],
  )

  function handleScanSubmit() {
    const domain = domainInput.trim()
    if (!domain) return
    void runScan(domain)
  }

  function handleReset() {
    setPhase('idle')
    setDomainInput('')
    setScanResult(null)
    setUnreachable(null)
    setClaim(null)
    setStatus(null)
    setWidgetVerifiedDomain(null)
    router.replace('/demo', { scroll: false })
  }

  // Restores the report view from the URL's own `?scan=` param on first
  // mount — e.g. after a refresh, which otherwise loses `scanResult` back
  // to the empty form since it's client state only. Reads `searchParams`
  // once, deliberately: this effect's own `router.replace` calls (here and
  // in `runScan`/`handleReset`) update the URL going forward, and re-firing
  // on every such change would re-fetch a scan this component itself just
  // set. Restoring `scanResult` re-triggers the claim effect below exactly
  // as a fresh scan would, since `claimRequestedForScanId` still starts out
  // unset.
  useEffect(() => {
    const scanId = searchParams.get('scan')
    if (!scanId) return
    const domain = searchParams.get('domain')

    let cancelled = false
    void (async () => {
      try {
        const restoreParams = new URLSearchParams({ scanId })
        if (domain) restoreParams.set('domain', domain)
        const response = await fetch(`/demo/api/scan?${restoreParams}`)
        if (!response.ok) throw new Error('scan not found')
        const data = (await response.json()) as ScanSuccess
        if (cancelled) return
        setScanResult(data)
        setPhase('report')
      } catch {
        // Expired or unknown scanId — fall back to the empty form quietly
        // rather than flashing an error for what's just a stale link.
        if (!cancelled) router.replace('/demo', { scroll: false })
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fires the server-side claim exactly once per scan — it mints both the
  // hosted verification link and the session token the embedded widget
  // needs, so it has to happen before either can render.
  useEffect(() => {
    if (!scanResult || claimRequestedForScanId.current === scanResult.scanId) {
      return
    }
    claimRequestedForScanId.current = scanResult.scanId

    void (async () => {
      try {
        const response = await fetch('/demo/api/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scanId: scanResult.scanId }),
        })
        if (!response.ok) return
        const data = (await response.json()) as ClaimSuccess
        setClaim(data)
      } catch {
        // The gate still renders — VerifyGate shows its own "preparing…" state.
      }
    })()
  }, [scanResult])

  const refreshStatus = useCallback(async () => {
    try {
      // Sends what the client itself durably knows — its own state, not
      // this instance's memory — so the poll can rehydrate server-side
      // state a restart or a different serverless instance lost (see
      // status/route.ts's `recoverClaim`/`recoverScan`).
      const params = new URLSearchParams()
      if (scanResult?.domain) params.set('domain', scanResult.domain)
      if (scanResult?.scanId) params.set('scanId', scanResult.scanId)
      const query = params.toString()
      const response = await fetch(
        `/demo/api/status${query ? `?${query}` : ''}`,
      )
      if (!response.ok) return
      const data = (await response.json()) as StatusResponse
      setStatus(data)
      // Re-syncs `claim`'s own token/link from the store's current values
      // on every poll (see status/route.ts) — not just the one poll that
      // happened to trigger a dead-claim reclaim, since a concurrent poll
      // can land after the store's already updated and would otherwise
      // never learn the new token, leaving the widget stuck rebinding to
      // one that 404s forever.
      if (data.frontendToken) {
        setClaim((prev) =>
          prev && prev.frontendToken !== data.frontendToken
            ? {
                ...prev,
                frontendToken: data.frontendToken ?? null,
                hostedUrl: data.hostedUrl ?? prev.hostedUrl,
              }
            : prev,
        )
      }
    } catch {
      // Next poll tick retries — no need to surface a transient network error.
    }
  }, [scanResult?.domain, scanResult?.scanId])

  // Drives `refreshStatus` on a schedule that never dies while the claim is
  // still pending: quick at first, then — past `STATUS_POLL_MAX_ATTEMPTS` —
  // settling onto a slow long tail instead of stopping, since a real DNS
  // provider can easily outlast the fast phase. Only `status?.verified`
  // turning `true` (this effect's own guard above, re-run via the
  // dependency below) ends it for good. Also re-checks immediately the
  // moment the tab regains visibility or focus, rather than leaving it to
  // whatever's left of the current tick's wait — a backgrounded tab's
  // timers are throttled by the browser anyway, so the schedule alone
  // can't be trusted to notice a regain promptly.
  useEffect(() => {
    if (!claim || status?.verified) return

    let cancelled = false
    let attempts = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    // Guards against `visibilitychange` and `focus` both firing for the
    // same regain and running two immediate re-checks instead of one.
    let regainInFlight = false

    function scheduleNext() {
      const delay =
        attempts >= STATUS_POLL_MAX_ATTEMPTS
          ? STATUS_POLL_LONG_TAIL_INTERVAL_MS
          : STATUS_POLL_INTERVAL_MS
      timeoutId = setTimeout(() => {
        timeoutId = undefined
        if (cancelled) return
        attempts += 1
        void refreshStatus().then(() => {
          if (!cancelled) scheduleNext()
        })
      }, delay)
    }

    function regain() {
      if (cancelled || regainInFlight) return
      regainInFlight = true
      Promise.resolve().then(() => {
        regainInFlight = false
      })
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      attempts += 1
      void refreshStatus().then(() => {
        if (!cancelled) scheduleNext()
      })
    }

    function handleVisibilityChange() {
      if (!document.hidden) regain()
    }

    void refreshStatus()
    scheduleNext()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', regain)

    return () => {
      cancelled = true
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', regain)
    }
  }, [claim, status?.verified, refreshStatus])

  function handleWidgetVerified(verification: Verification) {
    setWidgetVerifiedDomain(verification.domain)
    void refreshStatus()
  }

  return (
    <div className="min-h-screen bg-sg-paper-2">
      <div className="mx-auto max-w-3xl px-6 py-7 sm:px-10">
        <SiteNav />

        {phase === 'idle' && !restoring ? (
          <ScanForm
            domain={domainInput}
            onDomainChange={setDomainInput}
            onSubmit={handleScanSubmit}
            errorMessage={scanErrorMessage}
          />
        ) : null}

        {phase === 'scanning' && scanning ? (
          <ScanningState domain={scanning.domain} />
        ) : null}

        {phase === 'unreachable' && unreachable ? (
          <UnreachableState
            domain={unreachable.domain}
            reasons={unreachable.reasons}
            onRetry={() => void runScan(unreachable.domain)}
            onScanDifferent={handleReset}
          />
        ) : null}

        {phase === 'report' && scanResult ? (
          <ReportView
            domain={scanResult.domain}
            teaser={scanResult.teaser}
            grade={scanResult.grade}
            gradeLabel={scanResult.gradeLabel}
            verified={Boolean(status?.verified)}
            fullReport={status?.fullReport ?? null}
            verifiedAt={status?.verifiedAt ?? null}
            widgetVerifiedDomain={widgetVerifiedDomain}
            hostedUrl={claim?.hostedUrl ?? null}
            frontendToken={claim?.frontendToken ?? null}
            sessionToken={claim?.sessionToken ?? null}
            onVerified={handleWidgetVerified}
          />
        ) : null}
      </div>
    </div>
  )
}
