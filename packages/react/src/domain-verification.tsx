'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import {
  Button,
  Callout,
  Card,
  CardBody,
  TextField,
  VerificationView,
  cn,
} from '@domainproof/ui'
import { useClaimDomain } from './use-claim-domain'
import { useVerification } from './use-verification'
import { describeStatus } from './status-view'
import { verificationSteps } from './verification-steps'
import { absoluteGuideUrl, guideForProvider } from './provider-guide'
import type { Verification } from './types'

export interface DomainVerificationProps {
  /**
   * A single-use session token minted server-side via `@domainproof/sdk`'s
   * `componentSessions.create` — the component claims a domain itself via
   * the "Verify a domain" input. Mutually exclusive with `frontendToken`;
   * provide exactly one.
   */
  sessionToken?: string
  /**
   * Renders already bound to an existing claim, identified by its
   * `frontendToken` — skips the claim step entirely and shows that claim's
   * live status right away. Use when the domain was already claimed some
   * other way (e.g. server-side, via `@domainproof/sdk`'s
   * `domains.claim`) and this component only needs to display and
   * auto-check its progress. A claim's `frontendToken` is the last path
   * segment of its `verificationUrl` — the same token the hosted
   * verification page (`/verify/:token`) uses. Mutually exclusive with
   * `sessionToken`; takes priority if both are somehow given.
   */
  frontendToken?: string
  /** Overrides `DomainProofProvider`'s `baseUrl` for this instance. */
  baseUrl?: string
  /** Called once, the first time this claim's status reaches `'verified'`. */
  onVerified?: (verification: Verification) => void
  className?: string
  /**
   * Applied directly to the component's own root element, where every
   * design token below resolves — the one place `--accent`, `--bg`,
   * `--radius-md` and the rest can be overridden per-instance (see
   * README.md's theming section for the full list). An ancestor element
   * won't do it: the compiled stylesheet declares these directly on this
   * root, and a direct declaration always wins over an inherited one.
   */
  style?: CSSProperties
  /** Selects the compiled token set — defaults to `'dark'`, DomainProof's own default theme. */
  theme?: 'light' | 'dark'
}

/**
 * A single-use component session is consumed the moment a claim attempt
 * runs — successfully or not (see `modules/component-sessions/service.ts`'s
 * `claimDomain` doc comment) — except a `429` (rate limited), which never
 * reaches that far. So a failed claim only stays retryable with the same
 * `sessionToken` when it was rate limited or never left the browser
 * (network error); anything else needs a fresh session from the backend.
 */
function isClaimRetryable(
  error: ReturnType<typeof useClaimDomain>['error'],
): boolean {
  if (!error) return true
  if (error.kind === 'network') return true
  return error.status === 429
}

/**
 * Drop-in verification card: composes {@link useClaimDomain} and
 * {@link useVerification} with `@domainproof/ui`'s `VerificationView` — the
 * same steps/status header, record-card section, and outcome card the
 * hosted verification page renders — for a domain input, TXT record
 * display (with per-field copy), and bounded auto-checking. Ships with a
 * compiled stylesheet (`@domainproof/react/styles.css`, import once)
 * rather than a runtime Tailwind build — for full control over markup and
 * styling instead, compose the two hooks directly.
 */
export function DomainVerification({
  sessionToken,
  frontendToken: boundFrontendToken,
  baseUrl,
  onVerified,
  className,
  style,
  theme,
}: DomainVerificationProps) {
  const isBound = boundFrontendToken != null
  const [domainInput, setDomainInput] = useState('')
  const {
    status: claimStatus,
    data: claimData,
    error: claimError,
    claim,
  } = useClaimDomain(sessionToken ?? '', { baseUrl })

  const frontendToken = boundFrontendToken ?? claimData?.frontendToken ?? null
  const {
    verification,
    status: verificationStatus,
    error: verificationError,
    isPolling,
    isVerifying,
    verify,
  } = useVerification(frontendToken, { baseUrl })

  const notifiedRef = useRef(false)
  useEffect(() => {
    if (verification?.status === 'verified' && !notifiedRef.current) {
      notifiedRef.current = true
      onVerified?.(verification)
    }
  }, [verification, onVerified])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const domain = domainInput.trim()
    if (!domain) return
    await claim(domain)
  }

  const rootClassName = cn('dp-widget', className)

  if (isBound && !verification) {
    if (verificationStatus === 'error') {
      return (
        <div className={rootClassName} style={style} data-theme={theme}>
          <Card>
            <CardBody>
              <h3 className="mb-3 text-lg font-heading">Verify a domain</h3>
              <Callout tone="danger">
                {verificationError?.kind === 'http'
                  ? verificationError.message
                  : "Couldn't load this verification. Try again shortly."}
              </Callout>
            </CardBody>
          </Card>
        </div>
      )
    }

    return (
      <div className={rootClassName} style={style} data-theme={theme}>
        <Card>
          <CardBody>
            <div
              aria-hidden="true"
              className="h-40 w-full animate-pulse rounded-md bg-surface-2"
            />
          </CardBody>
        </Card>
      </div>
    )
  }

  if (!isBound && !claimData) {
    if (claimStatus === 'error' && !isClaimRetryable(claimError)) {
      return (
        <div className={rootClassName} style={style} data-theme={theme}>
          <Card>
            <CardBody>
              <h3 className="mb-3 text-lg font-heading">Verify a domain</h3>
              <Callout tone="danger">
                This verification link has already been used. Ask for a new one
                to try again.
              </Callout>
            </CardBody>
          </Card>
        </div>
      )
    }

    return (
      <div className={rootClassName} style={style} data-theme={theme}>
        <Card>
          <CardBody>
            <h3 className="mb-3 text-lg font-heading">Verify a domain</h3>
            <form onSubmit={(event) => void handleSubmit(event)}>
              <TextField
                label="Domain"
                placeholder="acme.com"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                disabled={claimStatus === 'claiming'}
                trailing={
                  <Button
                    type="submit"
                    variant="primary"
                    loading={claimStatus === 'claiming'}
                    disabled={!domainInput.trim()}
                  >
                    {claimStatus === 'claiming' ? 'Claiming…' : 'Claim domain'}
                  </Button>
                }
              />
              {claimError ? (
                <p
                  className={cn(
                    'mt-2 text-xs',
                    claimError.kind === 'network'
                      ? 'text-danger'
                      : 'text-warning-strong',
                  )}
                >
                  {claimError.kind === 'network'
                    ? "Couldn't reach DomainProof. Check your connection and try again."
                    : 'Too many attempts — wait a moment and try again.'}
                </p>
              ) : null}
            </form>
          </CardBody>
        </Card>
      </div>
    )
  }

  // One of `verification` (bound mode, or after the auto-load that follows
  // a fresh claim) or `claimData` (the instant after a fresh claim, before
  // that auto-load resolves) is always populated here — the two guards
  // above return early otherwise.
  const domain = verification?.domain ?? claimData?.domain ?? ''
  const currentStatus = verification?.status ?? claimData?.status ?? 'pending'
  const check = verification?.check ?? claimData?.check ?? null
  const records = verification?.records ?? claimData?.records ?? []
  const provider = verification?.provider ?? claimData?.provider ?? 'unknown'
  const projectName = verification?.projectName ?? claimData?.projectName ?? ''
  const isTerminal = currentStatus === 'verified' || currentStatus === 'failed'

  const view = describeStatus({
    status: currentStatus,
    check,
    domain,
    projectName,
  })
  const outcomeTone = view.tone === 'pending' ? null : view.tone
  const guide = view.showRecheck ? guideForProvider(provider) : null

  return (
    <div className={rootClassName} style={style} data-theme={theme}>
      <VerificationView
        steps={verificationSteps({ status: currentStatus, check })}
        tone={view.tone}
        badgeLabel={view.badgeLabel}
        meta={isPolling ? 'Checking automatically…' : null}
        unreachableNote={view.unreachableNote}
        outcome={
          outcomeTone
            ? {
                tone: outcomeTone,
                heading: view.heading,
                body: view.body,
                check: view.showDiff ? check : null,
              }
            : null
        }
        record={
          guide
            ? {
                domain,
                records,
                guideUrl: absoluteGuideUrl(guide),
                guideLabel: guide.name,
              }
            : null
        }
      />

      {verificationError ? (
        <Callout tone="warning" className="mt-4">
          {verificationError.kind === 'network'
            ? "Couldn't reach DomainProof — we'll keep trying."
            : verificationError.message}
        </Callout>
      ) : null}

      {!isTerminal ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => void verify()} loading={isVerifying}>
            {isVerifying ? 'Checking…' : 'Check now'}
          </Button>
          {isPolling ? (
            <span className="text-xs text-faint-foreground">
              Checking automatically…
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
