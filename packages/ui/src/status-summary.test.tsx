import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusSummary, Stepper } from './status-summary'
import { Badge } from './badge'

const STEPS = [
  {
    id: 'claimed',
    status: 'done' as const,
    label: 'Claimed',
    time: '09:41',
  },
  {
    id: 'record',
    status: 'done' as const,
    label: 'Record added',
    time: '09:52',
  },
  {
    id: 'propagated',
    status: 'current' as const,
    label: 'Propagated',
  },
  { id: 'verified', status: 'upcoming' as const, label: 'Verified' },
]

describe('Stepper', () => {
  it('renders every step label', () => {
    render(<Stepper steps={STEPS} />)
    expect(screen.getByText('Claimed')).toBeTruthy()
    expect(screen.getByText('Record added')).toBeTruthy()
    expect(screen.getByText('Propagated')).toBeTruthy()
    expect(screen.getByText('Verified')).toBeTruthy()
  })

  it('renders one fewer connector than steps', () => {
    const { container } = render(<Stepper steps={STEPS} />)
    const connectors = container.querySelectorAll('span.min-w-3')
    expect(connectors).toHaveLength(STEPS.length - 1)
  })

  it('renders a failed step in its own danger tone, distinct from upcoming', () => {
    const steps = [
      ...STEPS.slice(0, 2),
      {
        id: 'propagated',
        status: 'failed' as const,
        node: '✕',
        label: 'Propagated',
      },
      {
        id: 'verified',
        status: 'upcoming' as const,
        node: '4',
        label: 'Verified',
      },
    ]
    render(<Stepper steps={steps} />)
    const failedLabel = screen.getByText('Propagated')
    expect(failedLabel.className).toContain('text-danger')
    const failedNode = failedLabel
      .closest('div')
      ?.querySelector('span:first-child')
    expect(failedNode?.className).toContain('border-danger')
    expect(failedNode?.className).toContain('bg-danger-soft')
  })

  it('stays a single scrollable row at every width, never stacking', () => {
    const { container } = render(<Stepper steps={STEPS} />)
    expect(container.firstElementChild?.className).toContain('overflow-x-auto')
    expect(container.firstElementChild?.className).not.toContain('flex-wrap')
    const connector = container.querySelector('span.min-w-3')
    expect(connector?.className).not.toContain('hidden')
    expect(screen.getByText('Claimed').closest('div')?.className).toContain(
      'shrink-0',
    )
  })

  it('gives the current step a pulsing dot and a failed step a distinct danger mark', () => {
    const { container } = render(
      <Stepper
        steps={[
          { id: 'claimed', status: 'done', label: 'Claimed' },
          { id: 'record', status: 'failed', label: 'Record added' },
          { id: 'propagated', status: 'upcoming', label: 'Propagated' },
          { id: 'verified', status: 'upcoming', label: 'Verified' },
        ]}
      />,
    )
    expect(container.querySelector('.animate-dp-pulse')).toBeNull()
    expect(container.querySelector('.text-danger')).toBeTruthy()
  })

  it('pulses the current step alone, live-not-stuck', () => {
    const { container } = render(<Stepper steps={STEPS} />)
    const pulses = container.querySelectorAll('.animate-dp-pulse')
    expect(pulses).toHaveLength(1)
  })
})

describe('StatusSummary', () => {
  it('renders the status badge, meta, and stepper together', () => {
    render(
      <StatusSummary
        statusBadge={<Badge tone="success">Verified</Badge>}
        meta={[
          { label: 'Last checked', value: '2 min ago' },
          { label: 'Next check', value: 'in ~3 min' },
        ]}
        steps={STEPS}
      />,
    )
    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0)
    expect(screen.getByText('Last checked')).toBeTruthy()
    expect(screen.getByText('in ~3 min')).toBeTruthy()
    expect(screen.getByText('Propagated')).toBeTruthy()
  })

  it('omits the header row entirely when no statusBadge or meta is given', () => {
    const { container } = render(<StatusSummary steps={STEPS} />)
    expect(screen.queryByText('Last checked')).toBeNull()
    expect(container.querySelector('.mb-6.flex')).toBeNull()
  })
})
