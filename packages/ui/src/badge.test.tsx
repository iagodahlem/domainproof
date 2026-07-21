import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge, ProviderBadge, StatusPill } from './badge'

describe('Badge', () => {
  it('renders its tone classes', () => {
    render(<Badge tone="danger">Needs attention</Badge>)
    expect(screen.getByText('Needs attention').className).toContain(
      'text-danger',
    )
  })

  it('defaults to the neutral tone', () => {
    render(<Badge>Not found</Badge>)
    expect(screen.getByText('Not found').className).toContain('text-text-muted')
  })

  it('drops the visible border in mode-pill treatment', () => {
    render(
      <Badge tone="warning" mode>
        TEST MODE
      </Badge>,
    )
    const el = screen.getByText('TEST MODE')
    expect(el.className).toContain('border-transparent')
    expect(el.className).toContain('tracking-normal')
  })
})

describe('ProviderBadge', () => {
  it('renders provider text without an icon', () => {
    render(<ProviderBadge>Cloudflare</ProviderBadge>)
    expect(screen.getByText('Cloudflare')).toBeTruthy()
  })

  it('renders an icon alongside the provider text', () => {
    render(
      <ProviderBadge icon={<svg data-testid="provider-icon" />}>
        Cloudflare
      </ProviderBadge>,
    )
    expect(screen.getByTestId('provider-icon')).toBeTruthy()
    expect(screen.getByText('Cloudflare')).toBeTruthy()
  })
})

describe('StatusPill', () => {
  it('renders its label', () => {
    render(<StatusPill tone="success">Verified</StatusPill>)
    expect(screen.getByText('Verified')).toBeTruthy()
  })

  it('does not animate the dot by default', () => {
    const { container } = render(
      <StatusPill tone="warning">Propagating</StatusPill>,
    )
    const dot = container.querySelector('span > span')
    expect(dot?.className).not.toContain('animate-dp-pulse')
  })

  it('animates the dot when pulse is set', () => {
    const { container } = render(
      <StatusPill tone="success" pulse>
        Verified
      </StatusPill>,
    )
    const dot = container.querySelector('span > span')
    expect(dot?.className).toContain('animate-dp-pulse')
  })

  it('applies the small size classes', () => {
    render(
      <StatusPill tone="success" size="small">
        Verified
      </StatusPill>,
    )
    expect(screen.getByText('Verified').className).toContain('text-2xs')
  })
})
