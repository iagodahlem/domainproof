import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StepperStep } from './status-summary'
import { VerificationProgress } from './verification-progress'

const STEPS: StepperStep[] = [
  { id: 'claimed', status: 'done', label: 'Claimed' },
  { id: 'record-added', status: 'current', label: 'Record added' },
  { id: 'propagated', status: 'upcoming', label: 'Propagated' },
  { id: 'verified', status: 'upcoming', label: 'Verified' },
]

describe('VerificationProgress', () => {
  it('renders the badge label and the stepper', () => {
    render(
      <VerificationProgress
        steps={STEPS}
        tone="pending"
        badgeLabel="Pending"
      />,
    )
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('Record added')).toBeTruthy()
  })

  it('shows the one-liner meta text beside the badge only when passed', () => {
    const { rerender } = render(
      <VerificationProgress
        steps={STEPS}
        tone="pending"
        badgeLabel="Pending"
        meta="Checking automatically, every 20s."
      />,
    )
    expect(screen.getByText('Checking automatically, every 20s.')).toBeTruthy()

    rerender(
      <VerificationProgress
        steps={STEPS}
        tone="success"
        badgeLabel="Verified"
      />,
    )
    expect(screen.queryByText('Checking automatically, every 20s.')).toBeNull()
  })

  it('surfaces an unreachable note when passed', () => {
    render(
      <VerificationProgress
        steps={STEPS}
        tone="pending"
        badgeLabel="Pending"
        unreachableNote="We couldn't get a reliable answer from acme.co's DNS servers."
      />,
    )
    expect(screen.getByText(/couldn't get a reliable answer/i)).toBeTruthy()
  })
})
