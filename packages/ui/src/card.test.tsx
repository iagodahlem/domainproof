import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card, CardBody, CardHead, CardRow } from './card'

describe('Card composition', () => {
  it('renders a head, body, and rows together', () => {
    render(
      <Card>
        <CardHead>Ownership record</CardHead>
        <CardBody>
          <CardRow>Host</CardRow>
          <CardRow>Value</CardRow>
        </CardBody>
      </Card>,
    )

    expect(screen.getByText('Ownership record')).toBeTruthy()
    expect(screen.getByText('Host')).toBeTruthy()
    expect(screen.getByText('Value')).toBeTruthy()
  })

  it('gives the card the surface/border/shadow treatment', () => {
    render(<Card data-testid="card">content</Card>)
    const el = screen.getByTestId('card')
    expect(el.className).toContain('bg-[var(--surface)]')
    expect(el.className).toContain('rounded-[var(--radius-lg)]')
  })

  it('gives the head a raised surface and bottom border', () => {
    render(<CardHead data-testid="head">Ownership record</CardHead>)
    const el = screen.getByTestId('head')
    expect(el.className).toContain('bg-[var(--surface-2)]')
    expect(el.className).toContain('border-b')
  })

  it('drops the bottom border on the last row', () => {
    render(
      <Card>
        <CardRow data-testid="row-1">Host</CardRow>
        <CardRow data-testid="row-2">Value</CardRow>
      </Card>,
    )
    expect(screen.getByTestId('row-2').className).toContain('last:border-b-0')
  })
})
