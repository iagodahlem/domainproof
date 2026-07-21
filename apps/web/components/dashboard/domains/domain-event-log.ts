import type { ReactNode } from 'react'
import type { VerificationLogEntry } from '@domainproof/ui'
import type { DomainEvent } from '@/lib/api'
import { checkOutcomePresentation } from './domain-check-outcome'
import { formatRelativeTime } from './format-relative-time'

function extractOutcome(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'outcome' in payload) {
    const outcome = (payload as { outcome: unknown }).outcome
    return typeof outcome === 'string' ? outcome : undefined
  }
  return undefined
}

function summaryFor(event: DomainEvent): ReactNode {
  switch (event.type) {
    case 'domain.claimed':
      return 'Claimed — a verification record was generated.'
    case 'domain.challenge_regenerated':
      return 'Challenge regenerated — a fresh record was issued.'
    case 'domain.check_passed':
      return 'Found the expected record.'
    case 'domain.check_failed': {
      const outcome = extractOutcome(event.payload)
      return outcome
        ? checkOutcomePresentation(outcome).message
        : 'A verification check did not pass.'
    }
    case 'domain.verified':
      return 'Marked verified.'
    case 'domain.temporarily_failed':
      return 'Lost its record — entered a 72-hour grace window.'
    case 'domain.failed':
      return 'Verification failed.'
    default:
      return event.type
  }
}

/** `DomainEvent[]` (oldest first, per `listDomainEvents`) to `VerificationLog`'s entry shape — no technical `detail` toggle, since this domain-events stream doesn't carry raw DNS lookup output the way a live check does. */
export function toVerificationLogEntries(
  events: DomainEvent[],
): VerificationLogEntry[] {
  return events.map((event) => ({
    id: event.id,
    time: formatRelativeTime(event.createdAt),
    summary: summaryFor(event),
  }))
}
