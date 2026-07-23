import {
  Callout,
  Stepper,
  StatusPill,
  type StepperStep,
  type Tone,
} from '@domainproof/ui'
import type { StatusTone } from '../_lib/status-view'

// `pending` reads as `warning` (amber), matching both the design board's
// token semantics (accent/success is reserved for the verified state — the
// product's whole job is proving something true, so brand and "verified"
// share one color on purpose) and the dashboard's own
// `domainStatusPresentation` — a pending pill must never look like a
// verified one.
const BADGE_TONE_BY_STATUS_TONE: Record<StatusTone, Tone> = {
  pending: 'warning',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
}

export interface VerificationProgressProps {
  steps: StepperStep[]
  tone: StatusTone
  badgeLabel: string
  /** The one-liner shown beside the badge — must stay a single line at this page's narrow container width, so callers pass already-tightened copy (e.g. only while actively polling). */
  meta: string | null
  unreachableNote: string | null
}

export function VerificationProgress({
  steps,
  tone,
  badgeLabel,
  meta,
  unreachableNote,
}: VerificationProgressProps) {
  return (
    <div className="flex flex-col gap-3">
      <Stepper steps={steps} />
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          tone={BADGE_TONE_BY_STATUS_TONE[tone]}
          size="small"
          pulse={tone === 'pending'}
        >
          {badgeLabel}
        </StatusPill>
        {meta ? (
          <span className="text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {unreachableNote ? (
        <Callout tone="neutral" emphasis="dashed">
          {unreachableNote}
        </Callout>
      ) : null}
    </div>
  )
}
