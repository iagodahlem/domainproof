import type { ReactNode } from 'react'
import {
  OutcomeCard,
  type OutcomeCardCheck,
  type OutcomeCardProps,
} from './outcome-card'
import {
  RecordCardSection,
  type RecordCardSectionRecord,
} from './record-card-section'
import {
  VerificationProgress,
  type VerificationStatusTone,
} from './verification-progress'
import type { StepperStep } from './status-summary'
import { cn } from './cn'

export interface VerificationViewOutcome {
  tone: OutcomeCardProps['tone']
  heading: string
  body: string
  check?: OutcomeCardCheck | null
}

export interface VerificationViewRecord {
  domain: string
  records: RecordCardSectionRecord[]
  guideUrl: string
  guideLabel?: string | null
}

export interface VerificationViewProps {
  steps: StepperStep[]
  tone: VerificationStatusTone
  badgeLabel: string
  meta?: string | null
  unreachableNote?: string | null
  /** The resolved/needs-attention state — omit while still pending, nothing notable to show yet. */
  outcome?: VerificationViewOutcome | null
  /** The DNS record to add — omit once there's nothing left to add (verified, or a terminal failure with no self-service recovery). */
  record?: VerificationViewRecord | null
  /** Rendered between the status header and the outcome card — e.g. a transient poll-error notice. */
  beforeOutcome?: ReactNode
  /** Rendered between the outcome card and the record card — e.g. a provider-specific one-click fastpath. */
  beforeRecord?: ReactNode
  /** Rendered after the record card — e.g. an agent hand-off reveal. */
  afterRecord?: ReactNode
  className?: string
}

/**
 * The verification core shared by the hosted `/verify/[token]` page and
 * `@domainproof/react`'s embeddable `DomainVerification`: the steps/status
 * header, the resolved/needs-attention outcome, and the DNS record to add
 * with its provider-guide link — composed the same way in both places so
 * neither ever falls behind the other. Callers own everything data-shaped
 * (fetching, polling, deriving `steps`/`tone`/`outcome` from a status) and
 * everything hosted-page-only (branding header, Cloudflare fastpath, agent
 * hand-off, page chrome) via the `before`/`after` slots instead of props
 * this component would have to understand.
 */
export function VerificationView({
  steps,
  tone,
  badgeLabel,
  meta = null,
  unreachableNote = null,
  outcome = null,
  record = null,
  beforeOutcome,
  beforeRecord,
  afterRecord,
  className,
}: VerificationViewProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <VerificationProgress
        steps={steps}
        tone={tone}
        badgeLabel={badgeLabel}
        meta={meta}
        unreachableNote={unreachableNote}
      />

      {beforeOutcome}

      {outcome ? (
        <OutcomeCard
          tone={outcome.tone}
          heading={outcome.heading}
          body={outcome.body}
          check={outcome.check ?? null}
        />
      ) : null}

      {record ? (
        <>
          {beforeRecord}
          <RecordCardSection
            domain={record.domain}
            records={record.records}
            guideUrl={record.guideUrl}
            guideLabel={record.guideLabel}
          />
          {afterRecord}
        </>
      ) : null}
    </div>
  )
}
