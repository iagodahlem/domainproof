import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { verificationSteps } from '../_lib/verification-steps'
import { VerificationProgress } from './verification-progress'

describe('VerificationProgress', () => {
  it('renders the badge label and the stepper', () => {
    render(
      <VerificationProgress
        steps={verificationSteps({ status: 'pending', check: null })}
        tone="pending"
        badgeLabel="Pending"
        meta={null}
        unreachableNote={null}
      />,
    )
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('Record added')).toBeTruthy()
  })

  it('shows the one-liner meta text beside the badge only when passed', () => {
    const { rerender } = render(
      <VerificationProgress
        steps={verificationSteps({ status: 'pending', check: null })}
        tone="pending"
        badgeLabel="Pending"
        meta="Checking automatically, every 20s."
        unreachableNote={null}
      />,
    )
    expect(screen.getByText('Checking automatically, every 20s.')).toBeTruthy()

    rerender(
      <VerificationProgress
        steps={verificationSteps({ status: 'verified', check: null })}
        tone="success"
        badgeLabel="Verified"
        meta={null}
        unreachableNote={null}
      />,
    )
    expect(screen.queryByText('Checking automatically, every 20s.')).toBeNull()
  })

  it('surfaces an unreachable note when passed', () => {
    render(
      <VerificationProgress
        steps={verificationSteps({ status: 'pending', check: null })}
        tone="pending"
        badgeLabel="Pending"
        meta={null}
        unreachableNote="We couldn't get a reliable answer from acme.co's DNS servers."
      />,
    )
    expect(screen.getByText(/couldn't get a reliable answer/i)).toBeTruthy()
  })
})
