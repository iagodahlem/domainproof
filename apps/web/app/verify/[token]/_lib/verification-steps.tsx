import { Check } from 'lucide-react'
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

  // Still capable of automatic progress — a terminal `failed` is the only
  // status with nothing left to check, matching `describeStatus`'s own
  // `showRecheck` split.
  const active = status !== 'failed'

  const done = [true, recordAdded, propagated, verified]
  const firstNotDoneIndex = done.indexOf(false)

  function stepStatus(index: number): StepperStepStatus {
    if (done[index]) return 'done'
    return index === firstNotDoneIndex && active ? 'current' : 'upcoming'
  }

  function node(index: number, fallback: string) {
    return stepStatus(index) === 'done' ? (
      <Check aria-hidden="true" size={10} />
    ) : (
      fallback
    )
  }

  return [
    {
      id: 'claimed',
      status: 'done',
      node: <Check aria-hidden="true" size={10} />,
      label: 'Claimed',
    },
    {
      id: 'record-added',
      status: stepStatus(1),
      node: node(1, '2'),
      label: 'Record added',
    },
    {
      id: 'propagated',
      status: stepStatus(2),
      node: node(2, '3'),
      label: 'Propagated',
    },
    {
      id: 'verified',
      status: stepStatus(3),
      node: node(3, '4'),
      label: 'Verified',
    },
  ]
}
