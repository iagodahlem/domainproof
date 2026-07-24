import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CloudflareFastpathCard } from './cloudflare-fastpath-card'

describe('CloudflareFastpathCard', () => {
  it('names the detected provider and domain, with a one-click CTA', () => {
    render(
      <CloudflareFastpathCard
        token="tok_1"
        domain="acme.co"
        cloudflareOutcome={null}
      />,
    )
    expect(screen.getByText(/Detected: Cloudflare manages DNS/i)).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Add this record for me' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Connect Cloudflare' }),
    ).toBeTruthy()
  })

  it('renders an honest message for a failure outcome', () => {
    render(
      <CloudflareFastpathCard
        token="tok_1"
        domain="acme.co"
        cloudflareOutcome="no_matching_zone"
      />,
    )
    expect(screen.getByText(/couldn't find this domain/i)).toBeTruthy()
  })

  it('renders the in-progress message for a success outcome', () => {
    render(
      <CloudflareFastpathCard
        token="tok_1"
        domain="acme.co"
        cloudflareOutcome="success"
      />,
    )
    expect(screen.getByText(/checking now/i)).toBeTruthy()
  })

  it('shows no outcome message when the page did not just come back from the callback', () => {
    render(
      <CloudflareFastpathCard
        token="tok_1"
        domain="acme.co"
        cloudflareOutcome={null}
      />,
    )
    expect(screen.queryByText(/checking now/i)).toBeNull()
  })
})
