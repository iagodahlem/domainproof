import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from './logo'

describe('Logo', () => {
  it('renders the wordmark', () => {
    render(<Logo />)
    expect(screen.getByText('DomainProof')).toBeTruthy()
  })

  it('hides the icon mark from assistive tech', () => {
    const { container } = render(<Logo />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })

  it('merges a passed className onto the root', () => {
    render(<Logo className="opacity-50" />)
    expect(screen.getByText('DomainProof').className).toContain('opacity-50')
  })

  it('iconOnly keeps the wordmark for assistive tech but hides it visually', () => {
    render(<Logo iconOnly />)
    expect(screen.getByText('DomainProof').className).toContain('sr-only')
  })
})
