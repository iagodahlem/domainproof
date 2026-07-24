import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExpiredLinkCard } from './expired-link-card'

describe('ExpiredLinkCard', () => {
  it('tells the visitor to ask the project for a new link', () => {
    render(<ExpiredLinkCard projectName="Acme" />)
    expect(screen.getByText(/this verification link expired/i)).toBeTruthy()
    expect(
      screen.getByText(/ask acme to send a new verification link/i),
    ).toBeTruthy()
  })
})
