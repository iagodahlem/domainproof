import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrowserChrome } from './browser-chrome'

describe('BrowserChrome', () => {
  it('renders the url in the mono address bar', () => {
    render(<BrowserChrome url="app.domainproof.dev/acme-app/events" />)
    expect(
      screen.getByText('app.domainproof.dev/acme-app/events').className,
    ).toContain('font-mono')
  })

  it('renders the window content below the chrome bar', () => {
    render(
      <BrowserChrome url="acme.co">
        <p>Window content</p>
      </BrowserChrome>,
    )
    expect(screen.getByText('Window content')).toBeTruthy()
  })

  it('hides the traffic-light dots from assistive tech', () => {
    const { container } = render(<BrowserChrome url="acme.co" />)
    const dots = container.querySelector('[aria-hidden="true"]')
    expect(dots).toBeTruthy()
  })
})
