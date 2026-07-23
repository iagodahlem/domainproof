import type { DomainStatus } from '@domainproof/core'
import type { StepperStep, StepperStepStatus } from '@domainproof/ui'
import type { VerificationCheck } from '@/lib/api/frontend'

export interface VerificationStepsInput {
  status: DomainStatus
  check: VerificationCheck | null
}

/**
 * The board's 4-step "Claimed / Record added / Propagated / Verified"
 * stepper — unlike the dashboard's own collapsed 3-step version (see
 * `domain-status-steps.tsx`'s doc comment), the two middle steps here are
 * derived from the *latest* check alone rather than a persisted history:
 * "record added" means the last check saw *some* TXT value at the label
 * (right or wrong — `outcome` is `found` or `wrong_value`, or `detected`
 * is non-empty), "propagated" means it saw the *correct* one (`found`).
 * Both count as already satisfied once `status` reaches `verified` or
 * `temporarily_failed`, since neither state is reachable without having
 * found the correct record at some point. Only "Claimed" and "Verified"
 * ever show a time — the middle two aren't discrete timestamped facts,
 * only inferences from the last check, so they never claim a time they
 * don't have.
 */
export function verificationSteps({
  status,
  check,
}: VerificationStepsInput): StepperStep[] {
  const everCorrect = status === 'verified' || status === 'temporarily_failed'
  const recordAdded =
    everCorrect ||
    check?.outcome === 'found' ||
    check?.outcome === 'wrong_value' ||
    (check?.detected?.length ?? 0) > 0
  const propagated = everCorrect || check?.outcome === 'found'
  const verified = status === 'verified'

  const done = [true, recordAdded, propagated, verified]
  const firstNotDoneIndex = done.indexOf(false)

  // A terminal `failed` is the only status with nothing left to check
  // (matching `describeStatus`'s own `showRecheck` split) — the step it
  // stalled on renders as blocked rather than still-in-progress.
  function stepStatus(index: number): StepperStepStatus {
    if (done[index]) return 'done'
    if (index !== firstNotDoneIndex) return 'upcoming'
    return status === 'failed' ? 'failed' : 'current'
  }

  return [
    { id: 'claimed', status: 'done', label: 'Claimed' },
    { id: 'record-added', status: stepStatus(1), label: 'Record added' },
    { id: 'propagated', status: stepStatus(2), label: 'Propagated' },
    { id: 'verified', status: stepStatus(3), label: 'Verified' },
  ]
}
