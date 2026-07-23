import type { StepperStep, StepperStepStatus } from '@domainproof/ui'
import type { DomainCheck, DomainDetail } from '@/lib/api/dashboard'
import { formatRelativeTime } from '@/lib/format-relative-time'

/**
 * The board's 4-step "Claimed / Record added / Propagated / Verified"
 * stepper — mirrored from the hosted verification page's own
 * `verificationSteps` (`app/verify/[token]/_lib/verification-steps.tsx`;
 * can't import a route-private module across routes, same reasoning as
 * `lib/query/domains.ts`'s mirrored `POLL_INTERVALS_MS`) rather than this
 * page's previous collapsed 3-step "Claimed / Verifying / Verified", which
 * drifted from the board's own vocabulary and from the hosted page's own
 * stepper for the identical moment.
 *
 * "Record added" and "propagated" aren't discrete, timestamped facts
 * anywhere in this data model — they're inferred from the *latest* check
 * alone (`check`), which is session-ephemeral (only ever populated by a
 * live "Check now"/auto-check this session, never persisted or returned by
 * a plain domain read): "record added" means the last check saw *some* TXT
 * value at the label (right or wrong), "propagated" means it saw the
 * *correct* one. Both count as already satisfied once `status` reaches
 * `verified`/`temporarily_failed`, since neither is reachable without
 * having found the correct record at some point. Only "Claimed" and
 * "Verified" ever show a time (`createdAt`/`verifiedAt` are real,
 * persisted facts) — the middle two never claim a time they don't have.
 *
 * One deliberate divergence from the hosted page's version: a hard
 * `failed` domain marks its first not-done step `'failed'` (the board's
 * `.hstepper-step.failed` modifier — a distinct danger-toned X, not just
 * `'upcoming'` gray) rather than leaving it merely inactive, so a stalled
 * verification reads as "this is where it broke" instead of "not started
 * yet". The hosted page's stepper has no such status; this one does
 * because `Stepper`'s `StepperStepStatus` gained a `'failed'` variant
 * specifically for this page (see `packages/ui`'s `status-summary.tsx`).
 *
 * A hard-failed domain never lets session-only `check` data pick *which*
 * step it stalled at. `check` resets to `null` on every reload, and the
 * events feed that could in principle recover it is paginated oldest-first
 * (`listDomainEvents`), so the triggering `domain.check_failed` — always
 * among the newest events on a domain with any history — isn't reliably in
 * the first page. Rather than have the same persisted `failed` domain claim
 * "Propagated" broke it right after a live check and "Record added" broke
 * it after a reload, `failed` always gets the one claim a reload can't
 * contradict: it stalled at "Record added". `everVerified` is unaffected —
 * a domain that reached `verified` before failing has real, persisted proof
 * both earlier steps happened.
 */
export function domainStatusSteps(
  domain: DomainDetail,
  check: DomainCheck | null,
): StepperStep[] {
  const everVerified =
    domain.status === 'verified' || domain.status === 'temporarily_failed'
  const failedTerminal = domain.status === 'failed'
  const recordAdded =
    everVerified ||
    (!failedTerminal &&
      (check?.outcome === 'found' ||
        check?.outcome === 'wrong_value' ||
        (check?.detected?.length ?? 0) > 0))
  const propagated =
    everVerified || (!failedTerminal && check?.outcome === 'found')
  const verified = domain.status === 'verified'

  const done = [true, recordAdded, propagated, verified]
  const firstNotDoneIndex = done.indexOf(false)

  function stepStatus(index: number): StepperStepStatus {
    if (done[index]) return 'done'
    if (index !== firstNotDoneIndex) return 'upcoming'
    return failedTerminal ? 'failed' : 'current'
  }

  return [
    {
      id: 'claimed',
      status: 'done',
      label: 'Claimed',
      time: formatRelativeTime(domain.createdAt),
    },
    {
      id: 'record-added',
      status: stepStatus(1),
      label: 'Record added',
    },
    {
      id: 'propagated',
      status: stepStatus(2),
      label: 'Propagated',
    },
    {
      id: 'verified',
      status: stepStatus(3),
      label: 'Verified',
      time: domain.verifiedAt
        ? formatRelativeTime(domain.verifiedAt)
        : undefined,
    },
  ]
}
