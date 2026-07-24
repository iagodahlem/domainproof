'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Check } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardRow,
  RecordCard,
  RecordField,
  StatusPill,
  StatusSummary,
  TextField,
  cn,
} from '@domainproof/ui'
import type { StepperStep, StepperStepStatus, Tone } from '@domainproof/ui'
import { useClaimDomain } from './use-claim-domain'
import { useVerification } from './use-verification'
import type { DomainStatus, Verification } from './types'

export interface DomainVerificationProps {
  /** A single-use session token minted server-side via `@domainproof/sdk`'s `componentSessions.create`. */
  sessionToken: string
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

const BADGE_TONE_BY_STATUS_TONE: Record<StatusTone, Tone> = {
  pending: 'warning',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
}

/**
 * The claim/verifying/verified progression as a 3-step `Stepper` — the
 * same collapsing the dashboard's own `domainStatusSteps` does (4 board
 * steps down to the 3 this data model can actually date-stamp), minus the
 * relative-timestamp `time` field: this package's wire type only carries
 * `updatedAt`, not the dashboard's `createdAt`/`verifiedAt` pair, so there's
 * nothing honest to put there.
 */
function verificationSteps(status: DomainStatus): StepperStep[] {
  const everVerified = status === 'verified' || status === 'temporarily_failed'
  const recovering = status === 'temporarily_failed'
  const neverVerifiedTerminal = status === 'failed'

  const verifyingStatus: StepperStepStatus = everVerified
    ? 'done'
    : neverVerifiedTerminal
      ? 'failed'
      : 'current'
  const verifiedStatus: StepperStepStatus = everVerified
    ? recovering
      ? 'current'
      : 'done'
    : 'upcoming'

  return [
    { id: 'claimed', status: 'done', label: 'Claimed' },
    { id: 'verifying', status: verifyingStatus, label: 'Verifying' },
    { id: 'verified', status: verifiedStatus, label: 'Verified' },
  ]
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
 * {@link useVerification} into DomainProof's own design system — the same
 * `RecordCard`/`RecordField`/`StatusSummary` components the hosted
 * verification page and dashboard render — for a domain input, TXT record
 * display (with per-field copy), a status stepper, bounded auto-checking,
 * and verified/failed outcome states. Ships with a compiled stylesheet
 * (`@domainproof/react/styles.css`, import once) rather than a runtime
 * Tailwind build — for full control over markup and styling instead,
 * compose the two hooks directly.
 */
export function DomainVerification({
  sessionToken,
  baseUrl,
  onVerified,
  className,
  style,
  theme,
}: DomainVerificationProps) {
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

  const rootClassName = cn('dp-widget', className)

  if (!claimData) {
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

  const currentStatus = verification?.status ?? claimData.status
  const view = STATUS_PRESENTATION[currentStatus]
  const records = verification?.records ?? claimData.records
  const isTerminal = currentStatus === 'verified' || currentStatus === 'failed'
  const isVerified = currentStatus === 'verified'

  return (
    <div className={rootClassName} style={style} data-theme={theme}>
      <RecordCard
        className="mb-6"
        step={isVerified ? <Check aria-hidden="true" size={10} /> : 1}
        stepTone={isVerified ? 'success' : 'accent'}
        title={claimData.domain}
        trailing={
          records[0] ? <Badge tone="accent">{records[0].type}</Badge> : null
        }
      >
        {records.map((record) => (
          <div key={record.label}>
            <RecordField label="Host" value={record.label} copyable />
            <RecordField label="Value" value={record.value} copyable />
          </div>
        ))}
        <CardRow>
          <Callout tone="warning" className="text-sm">
            Paste the value exactly as shown — some DNS providers add a trailing
            dot automatically. If verification keeps failing, check for one.
          </Callout>
        </CardRow>
      </RecordCard>

      <StatusSummary
        statusBadge={
          <StatusPill
            tone={BADGE_TONE_BY_STATUS_TONE[view.tone]}
            size="default"
            pulse={view.tone === 'pending'}
          >
            {view.label}
          </StatusPill>
        }
        steps={verificationSteps(currentStatus)}
      />

      <p className="text-sm leading-body text-muted-foreground">{view.body}</p>

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
