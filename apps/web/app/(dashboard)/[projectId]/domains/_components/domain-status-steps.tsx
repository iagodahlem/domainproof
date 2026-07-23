import { Check } from 'lucide-react'
import type { StepperStep } from '@domainproof/ui'
import type { DomainDetail } from '@/lib/api/dashboard'
import { formatRelativeTime } from '@/lib/format-relative-time'

/**
 * Collapses the board's 4-step "Claimed / Record added / Propagated /
 * Verified" stepper to the 3 facts the dashboard API actually exposes
 * (`status`, `createdAt`, `verifiedAt`) — "record added" and "propagated"
 * aren't discrete, timestamped facts anywhere in this data model, so
 * showing them as their own steps would be fabricated precision. A domain
 * that was verified once and later lost its record
 * (`temporarily_failed`) still shows "Verified" as reached (via
 * `verifiedAt`), with the step itself marked `current` while it recovers.
 */
export function domainStatusSteps(domain: DomainDetail): StepperStep[] {
  const everVerified = domain.verifiedAt != null
  const recovering = domain.status === 'temporarily_failed'
  const neverVerifiedTerminal = domain.status === 'failed' && !everVerified

  const verifyingStatus = everVerified
    ? 'done'
    : neverVerifiedTerminal
      ? 'upcoming'
      : 'current'
  const verifiedStatus = everVerified
    ? recovering
      ? 'current'
      : 'done'
    : 'upcoming'

  return [
    {
      id: 'claimed',
      status: 'done',
      node: <Check aria-hidden="true" size={10} />,
      label: 'Claimed',
      time: formatRelativeTime(domain.createdAt),
    },
    {
      id: 'verifying',
      status: verifyingStatus,
      node:
        verifyingStatus === 'done' ? (
          <Check aria-hidden="true" size={10} />
        ) : (
          '2'
        ),
      label: 'Verifying',
    },
    {
      id: 'verified',
      status: verifiedStatus,
      node:
        verifiedStatus === 'done' ? (
          <Check aria-hidden="true" size={10} />
        ) : (
          '3'
        ),
      label: 'Verified',
      time: domain.verifiedAt
        ? formatRelativeTime(domain.verifiedAt)
        : undefined,
    },
  ]
}
