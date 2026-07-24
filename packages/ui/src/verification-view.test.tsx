import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StepperStep } from './status-summary'
import { VerificationView } from './verification-view'

const STEPS: StepperStep[] = [
  { id: 'claimed', status: 'done', label: 'Claimed' },
  { id: 'record-added', status: 'current', label: 'Record added' },
  { id: 'propagated', status: 'upcoming', label: 'Propagated' },
  { id: 'verified', status: 'upcoming', label: 'Verified' },
]

const RECORDS = [
  {
    label: '_acme-challenge.acme.co',
    type: 'TXT',
    value: 'acme-verify=abc123',
  },
]

describe('VerificationView', () => {
  it('always renders the steps/status header', () => {
    render(
      <VerificationView steps={STEPS} tone="pending" badgeLabel="Pending" />,
    )
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('Record added')).toBeTruthy()
  })

  it('omits the outcome card until an outcome is passed', () => {
    const { rerender } = render(
      <VerificationView steps={STEPS} tone="pending" badgeLabel="Pending" />,
    )
    expect(screen.queryByText('Domain verified')).toBeNull()

    rerender(
      <VerificationView
        steps={STEPS}
        tone="success"
        badgeLabel="Verified"
        outcome={{
          tone: 'success',
          heading: 'Domain verified',
          body: 'acme.co is verified.',
        }}
      />,
    )
    expect(screen.getByText('Domain verified')).toBeTruthy()
  })

  it('omits the record card until a record is passed', () => {
    const { rerender } = render(
      <VerificationView steps={STEPS} tone="pending" badgeLabel="Pending" />,
    )
    expect(screen.queryByText('Add this DNS record')).toBeNull()

    rerender(
      <VerificationView
        steps={STEPS}
        tone="pending"
        badgeLabel="Pending"
        record={{
          domain: 'acme.co',
          records: RECORDS,
          guideUrl: '/docs/add-txt-record',
        }}
      />,
    )
    expect(screen.getByText('Add this DNS record')).toBeTruthy()
    expect(screen.getByText('_acme-challenge.acme.co')).toBeTruthy()
  })

  it('places beforeOutcome, beforeRecord, and afterRecord slots in document order', () => {
    const { container } = render(
      <VerificationView
        steps={STEPS}
        tone="warning"
        badgeLabel="Needs attention"
        outcome={{
          tone: 'warning',
          heading: 'Heads up',
          body: 'Something changed.',
        }}
        record={{
          domain: 'acme.co',
          records: RECORDS,
          guideUrl: '/docs/add-txt-record',
        }}
        beforeOutcome="poll error notice"
        beforeRecord="cloudflare fastpath"
        afterRecord="agent reveal"
      />,
    )

    const text = container.textContent ?? ''
    const positions = [
      'poll error notice',
      'Heads up',
      'cloudflare fastpath',
      'Add this DNS record',
      'agent reveal',
    ].map((needle) => text.indexOf(needle))

    expect(positions.every((position) => position !== -1)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})
