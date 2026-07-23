'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useClaimDomain } from './use-claim-domain'
import { useVerification } from './use-verification'
import { injectDomainProofStyles } from './styles'
import type { DomainStatus, Verification } from './types'

export interface DomainVerificationProps {
  /** A single-use session token minted server-side via `@domainproof/sdk`'s `componentSessions.create`. */
  sessionToken: string
  /** Overrides `DomainProofProvider`'s `baseUrl` for this instance. */
  baseUrl?: string
  /** Called once, the first time this claim's status reaches `'verified'`. */
  onVerified?: (verification: Verification) => void
  className?: string
}

type StatusTone = 'pending' | 'success' | 'warning' | 'danger'

const STATUS_PRESENTATION: Record<
  DomainStatus,
  { label: string; tone: StatusTone; body: string }
> = {
  not_started: {
    label: 'Not started',
    tone: 'pending',
    body: 'Add the DNS record below at your DNS provider, then check again.',
  },
  pending: {
    label: 'Pending',
    tone: 'pending',
    body: "We haven't found the record yet. DNS changes can take a few minutes to propagate — add the record below if you haven't yet.",
  },
  temporarily_failed: {
    label: 'Needs attention',
    tone: 'warning',
    body: 'This domain was verified, but the record is now missing or has changed. Restore it to keep verification active.',
  },
  failed: {
    label: 'Failed',
    tone: 'danger',
    body: 'Verification failed. Ask for a new verification link to try again.',
  },
  verified: {
    label: 'Verified',
    tone: 'success',
    body: 'This domain is verified. The DNS record can be removed at any time.',
  },
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      className="dp-copy-button"
      onClick={() => void handleClick()}
      aria-live="polite"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
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
 * {@link useVerification} into a domain input, TXT record display (with
 * per-field copy), a status indicator, bounded auto-checking, and
 * verified/failed outcome states. Ships minimal default styling themed
 * entirely through `--dp-*` CSS custom properties (see README.md) — for
 * full control over markup and styling, compose the two hooks directly
 * instead of this component.
 */
export function DomainVerification({
  sessionToken,
  baseUrl,
  onVerified,
  className,
}: DomainVerificationProps) {
  useEffect(() => {
    injectDomainProofStyles()
  }, [])

  const [domainInput, setDomainInput] = useState('')
  const {
    status: claimStatus,
    data: claimData,
    error: claimError,
    claim,
  } = useClaimDomain(sessionToken, { baseUrl })

  const frontendToken = claimData?.frontendToken ?? null
  const {
    verification,
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

  const containerClassName = ['dp-card', className].filter(Boolean).join(' ')

  if (!claimData) {
    if (claimStatus === 'error' && !isClaimRetryable(claimError)) {
      return (
        <div className={containerClassName}>
          <div className="dp-header">
            <h3 className="dp-title">Verify a domain</h3>
          </div>
          <p className="dp-error-text">
            This verification link has already been used. Ask for a new one to
            try again.
          </p>
        </div>
      )
    }

    return (
      <div className={containerClassName}>
        <div className="dp-header">
          <h3 className="dp-title">Verify a domain</h3>
        </div>
        <form
          className="dp-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label className="dp-input-label" htmlFor="dp-domain-input">
            Domain
          </label>
          <input
            id="dp-domain-input"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="dp-input"
            placeholder="acme.com"
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            disabled={claimStatus === 'claiming'}
          />
          <button
            type="submit"
            className="dp-button dp-button--primary"
            disabled={claimStatus === 'claiming' || !domainInput.trim()}
          >
            {claimStatus === 'claiming' ? 'Claiming…' : 'Claim domain'}
          </button>
          {claimError ? (
            <p className="dp-error-text">
              {claimError.kind === 'network'
                ? "Couldn't reach DomainProof. Check your connection and try again."
                : 'Too many attempts — wait a moment and try again.'}
            </p>
          ) : null}
        </form>
      </div>
    )
  }

  const currentStatus = verification?.status ?? claimData.status
  const view = STATUS_PRESENTATION[currentStatus]
  const records = verification?.records ?? claimData.records
  const isTerminal = currentStatus === 'verified' || currentStatus === 'failed'

  return (
    <div className={containerClassName}>
      <div className="dp-header">
        <h3 className="dp-title">{claimData.domain}</h3>
        <span className={`dp-badge dp-badge--${view.tone}`}>
          {view.tone === 'pending' ? (
            <span className="dp-badge-dot" aria-hidden="true" />
          ) : null}
          {view.label}
        </span>
      </div>

      <p className="dp-body-text">{view.body}</p>

      {records.map((record) => (
        <div className="dp-field" key={record.label}>
          <div className="dp-field-row">
            <span className="dp-field-label">Host</span>
            <span className="dp-field-value">{record.label}</span>
            <CopyButton value={record.label} />
          </div>
          <div className="dp-field-row">
            <span className="dp-field-label">Value</span>
            <span className="dp-field-value">{record.value}</span>
            <CopyButton value={record.value} />
          </div>
        </div>
      ))}

      {verificationError ? (
        <p className="dp-error-text">
          {verificationError.kind === 'network'
            ? "Couldn't reach DomainProof — we'll keep trying."
            : verificationError.message}
        </p>
      ) : null}

      {!isTerminal ? (
        <div className="dp-form">
          <button
            type="button"
            className="dp-button"
            onClick={() => void verify()}
            disabled={isVerifying}
          >
            {isVerifying ? 'Checking…' : 'Check now'}
          </button>
          {isPolling ? (
            <span className="dp-footer-text">Checking automatically…</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
