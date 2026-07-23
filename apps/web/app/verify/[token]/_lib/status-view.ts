import type { DomainStatus } from '@domainproof/core'
import type { VerificationCheck } from '@/lib/api/frontend'

export type StatusTone = 'pending' | 'success' | 'warning' | 'danger'

/**
 * A pure, presentation-only view of one (status, check) pair — everything
 * `StatusSection` needs to render, with no React and no fetching, so the
 * full state matrix (5 statuses × 5 check outcomes, most combinations
 * unreachable in practice but still possible over the wire) is unit-testable
 * without rendering anything. See `describeStatus`'s doc comment for the
 * matrix this is derived from.
 */
export interface StatusView {
  tone: StatusTone
  badgeLabel: string
  heading: string
  body: string
  /** Show the expected-vs-detected diff from `check`. */
  showDiff: boolean
  /** Show the "Recheck now" button — hidden once a domain is `verified` or `failed` (nothing left to check). */
  showRecheck: boolean
  /** A last check that came back `unreachable` doesn't change `status` — surfaced as a small note alongside whatever the primary state already is, not a state of its own. */
  unreachableNote: string | null
}

/**
 * Every outcome `VerifyDomainCheck.outcome` can carry (see
 * `apps/api/src/modules/domains/service.ts`). The wire type widens this to
 * `string` (same deliberate choice as the api's own `LastCheckSummary`), so
 * this is an `if`/`else if` chain with an honest fallback branch for an
 * outcome string this page doesn't recognize, not a compiler-checked
 * exhaustive switch.
 */
const KNOWN_OUTCOMES = [
  'found',
  'wrong_value',
  'not_found',
  'unreachable',
  'expired',
] as const

function isKnownOutcome(
  outcome: string,
): outcome is (typeof KNOWN_OUTCOMES)[number] {
  return (KNOWN_OUTCOMES as readonly string[]).includes(outcome)
}

export interface DescribeStatusInput {
  status: DomainStatus
  check: VerificationCheck | null
  domain: string
  projectName: string
}

/**
 * The state matrix this page renders, derived from
 * `apps/api/src/modules/domains/domain/verification-event.ts`'s
 * outcome-to-transition mapping and `states.ts`'s transition table:
 *
 * - `pending` + `wrong_value` is a *hard* failure (see `eventForCheckOutcome`
 *   — a syntactically valid but wrong record is actionable information, not
 *   "not there yet"), so it transitions straight to `failed`; it can never
 *   be observed as `(pending, wrong_value)` here.
 * - `unreachable` never drives a transition regardless of status — it means
 *   "we don't know," not a definitive answer — so it can coexist with any
 *   status, including `verified` (a background recheck that couldn't get an
 *   answer doesn't downgrade an already-verified domain).
 * - `failed` has no self-service recovery on this page: the Frontend API
 *   plane exposes no regenerate route (that's `/v1`/`/dashboard` only, both
 *   requiring a project credential this anonymous page never has), so a
 *   `failed` view never offers "Recheck now" — only "ask the project for a
 *   new link."
 * - A few (status, outcome) pairs the state machine should never actually
 *   produce (e.g. `verified` + `wrong_value`, since that combination would
 *   have transitioned to `temporarily_failed` in the same attempt that
 *   recorded it) still get a defensive, honest fallback rather than
 *   crashing — the API contract could change in ways this page's tests
 *   don't currently model.
 */
export function describeStatus({
  status,
  check,
  domain,
  projectName,
}: DescribeStatusInput): StatusView {
  const outcome = check && isKnownOutcome(check.outcome) ? check.outcome : null
  const unreachableNote =
    outcome === 'unreachable'
      ? `We couldn't get a reliable answer from ${domain}'s DNS servers on our last check. This is usually temporary — we'll keep checking automatically.`
      : null

  switch (status) {
    case 'not_started':
      return {
        tone: 'pending',
        badgeLabel: 'Not started',
        heading: "Verification hasn't started yet",
        body: 'Add the DNS record below at your provider, then check again.',
        showDiff: false,
        showRecheck: true,
        unreachableNote: null,
      }

    case 'pending': {
      if (outcome === 'wrong_value') {
        // Defensive only — see doc comment above.
        return {
          tone: 'warning',
          badgeLabel: 'Pending',
          heading: "We found a record, but it didn't match",
          body: `The TXT record at ${domain} doesn't match what we expected. Double-check the value below and update it, then check again.`,
          showDiff: true,
          showRecheck: true,
          unreachableNote: null,
        }
      }
      return {
        tone: 'pending',
        badgeLabel: 'Pending',
        heading:
          outcome === 'not_found' || outcome === null
            ? 'Waiting for your DNS record'
            : 'Verifying your DNS record',
        body: `No record found yet at ${domain}'s own nameservers — we check there directly to skip stale caches. DNS changes usually take a few minutes to appear, occasionally longer. Add the record below if you haven't yet, then check again.`,
        showDiff: false,
        showRecheck: true,
        unreachableNote,
      }
    }

    case 'temporarily_failed': {
      const heading =
        outcome === 'wrong_value'
          ? 'Your DNS record changed'
          : 'Your DNS record is missing again'
      return {
        tone: 'warning',
        badgeLabel: 'Needs attention',
        heading,
        body: `This domain was verified, but we no longer see the correct record at ${domain}. You have up to 72 hours from when this started to restore it before verification lapses. Add the record below, then check again.`,
        showDiff: outcome === 'wrong_value',
        showRecheck: true,
        unreachableNote,
      }
    }

    case 'failed': {
      if (outcome === 'expired') {
        return {
          tone: 'danger',
          badgeLabel: 'Failed',
          heading: 'This verification link expired',
          body: `The verification window closed before we ever saw a correct record at ${domain}. Ask ${projectName} for a new verification link to try again.`,
          showDiff: false,
          showRecheck: false,
          unreachableNote: null,
        }
      }
      if (outcome === 'wrong_value') {
        return {
          tone: 'danger',
          badgeLabel: 'Failed',
          heading: 'We found the wrong value',
          body: `The TXT record at ${domain} didn't match what we expected, so verification failed. Ask ${projectName} for a new verification link to try again.`,
          showDiff: true,
          showRecheck: false,
          unreachableNote: null,
        }
      }
      return {
        tone: 'danger',
        badgeLabel: 'Failed',
        heading: 'Your 72-hour window to fix this has closed',
        body: `This domain was verified, but the record went missing and wasn't restored in time. Ask ${projectName} for a new verification link to try again.`,
        showDiff: false,
        showRecheck: false,
        unreachableNote: null,
      }
    }

    case 'verified':
      return {
        tone: 'success',
        badgeLabel: 'Verified',
        heading: 'Domain verified',
        body: `${domain} is verified. This record can be removed from your DNS at any time — it doesn't do anything else.`,
        showDiff: false,
        showRecheck: false,
        unreachableNote,
      }

    default: {
      const exhaustive: never = status
      throw new Error(
        `Unhandled domain status in describeStatus: ${String(exhaustive)}`,
      )
    }
  }
}
