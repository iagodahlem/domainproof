'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  sessionToken: string | null
}

interface StatusResponse {
  claimed: boolean
  verified: boolean
  verifiedAt?: string | null
  fullReport: CheckResult[] | null
}

type Phase = 'idle' | 'scanning' | 'unreachable' | 'report'

const MIN_SCAN_DISPLAY_MS = 900
const STATUS_POLL_INTERVAL_MS = 5000
const STATUS_POLL_MAX_ATTEMPTS = 40

export function SitegradeApp() {
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

  const runScan = useCallback(async (domain: string) => {
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
  }, [])

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
  }

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
      const response = await fetch('/demo/api/status')
      if (!response.ok) return
      const data = (await response.json()) as StatusResponse
      setStatus(data)
    } catch {
      // Next poll tick retries — no need to surface a transient network error.
    }
  }, [])

  useEffect(() => {
    if (!claim || status?.verified) return

    let attempts = 0
    void refreshStatus()
    const interval = setInterval(() => {
      attempts += 1
      if (attempts >= STATUS_POLL_MAX_ATTEMPTS) {
        clearInterval(interval)
        return
      }
      void refreshStatus()
    }, STATUS_POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [claim, status?.verified, refreshStatus])

  function handleWidgetVerified(verification: Verification) {
    setWidgetVerifiedDomain(verification.domain)
    void refreshStatus()
  }

  return (
    <div className="min-h-screen bg-sg-paper-2">
      <div className="mx-auto max-w-3xl px-6 py-7 sm:px-10">
        <SiteNav />

        {phase === 'idle' ? (
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
            sessionToken={claim?.sessionToken ?? null}
            onVerified={handleWidgetVerified}
          />
        ) : null}
      </div>
    </div>
  )
}
