import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerticalTimeline } from './vertical-timeline'

describe('VerticalTimeline', () => {
  it('renders a title and description per step', () => {
    render(
      <VerticalTimeline
        steps={[
          {
            id: 'claimed',
            status: 'done',
            node: '✓',
            title: 'Claimed',
            description: 'Acme App asked us to verify acme.co.',
          },
          {
            id: 'verified',
            status: 'upcoming',
            node: '2',
            title: 'Verified',
          },
        ]}
      />,
    )
    expect(screen.getByText('Claimed')).toBeTruthy()
    expect(
      screen.getByText('Acme App asked us to verify acme.co.'),
    ).toBeTruthy()
    expect(screen.getByText('Verified')).toBeTruthy()
  })

  it('gives the current step an accent-colored title and node', () => {
    render(
      <VerticalTimeline
        steps={[
          {
            id: 'propagating',
            status: 'current',
            node: '3',
            title: 'Propagating',
          },
        ]}
      />,
    )
    expect(screen.getByText('Propagating').className).toContain(
      'text-[color:var(--accent)]',
    )
    expect(screen.getByText('3').className).toContain(
      'text-[color:var(--accent)]',
    )
  })

  it('fills a done node with the success tone', () => {
    render(
      <VerticalTimeline
        steps={[{ id: 'claimed', status: 'done', node: '✓', title: 'Claimed' }]}
      />,
    )
    expect(screen.getByText('✓').className).toContain('bg-[var(--success)]')
  })

  it('omits the connector line after the last step', () => {
    render(
      <VerticalTimeline
        steps={[
          { id: 'a', status: 'done', node: '✓', title: 'A' },
          { id: 'b', status: 'current', node: '2', title: 'B' },
        ]}
      />,
    )
    // one node per step, but only one connector line (steps.length - 1)
    expect(screen.getByText('✓').parentElement?.children).toHaveLength(2)
    expect(screen.getByText('2').parentElement?.children).toHaveLength(1)
  })
})
