import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusSummary, Stepper } from './status-summary'
import { Badge } from './badge'

const STEPS = [
  {
    id: 'claimed',
    status: 'done' as const,
    node: '✓',
    label: 'Claimed',
    time: '09:41',
  },
  {
    id: 'record',
    status: 'done' as const,
    node: '✓',
    label: 'Record added',
    time: '09:52',
  },
  {
    id: 'propagated',
    status: 'current' as const,
    node: '3',
    label: 'Propagated',
  },
  { id: 'verified', status: 'upcoming' as const, node: '4', label: 'Verified' },
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
    const connectors = container.querySelectorAll('span.min-w-\\[12px\\]')
    expect(connectors).toHaveLength(STEPS.length - 1)
  })

  it('stays a single scrollable row at every width, never stacking', () => {
    const { container } = render(<Stepper steps={STEPS} />)
    expect(container.firstElementChild?.className).toContain('overflow-x-auto')
    expect(container.firstElementChild?.className).not.toContain('flex-wrap')
    const connector = container.querySelector('span.min-w-\\[12px\\]')
    expect(connector?.className).not.toContain('hidden')
    expect(screen.getByText('Claimed').closest('div')?.className).toContain(
      'shrink-0',
    )
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
})
