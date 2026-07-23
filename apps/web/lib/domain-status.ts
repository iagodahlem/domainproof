import type { Tone } from '@domainproof/ui'
import type { DomainStatus } from '@/lib/api/dashboard'

export interface DomainStatusPresentation {
  label: string
  tone: Tone
}

/**
 * Copy/tone for each `DomainStatus`, matching the board's vocabulary
 * (`pending` reads as "Propagating", `temporarily_failed` as "Recovering" —
 * builder-facing language, not the state machine's internal names).
 * `not_started` never actually reaches the dashboard today (`claimDomain`
 * always issues a challenge synchronously, landing a fresh claim on
 * `pending`), but is mapped defensively rather than left to fall through.
 */
const DOMAIN_STATUS_PRESENTATION: Record<
  DomainStatus,
  DomainStatusPresentation
> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  pending: { label: 'Propagating', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  temporarily_failed: { label: 'Recovering', tone: 'warning' },
  failed: { label: 'Needs attention', tone: 'danger' },
}

export function domainStatusPresentation(
  status: DomainStatus,
): DomainStatusPresentation {
  return DOMAIN_STATUS_PRESENTATION[status]
}
