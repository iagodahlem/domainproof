import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerifyHeader } from './verify-header'

describe('VerifyHeader', () => {
  it('states the domain to verify and who requested it', () => {
    render(
      <VerifyHeader domain="acme.co" projectName="Acme" variant="active" />,
    )
    expect(screen.getByText(/Verify ownership of/)).toBeTruthy()
    expect(screen.getByText(/Requested by Acme/)).toBeTruthy()
    expect(screen.getAllByText(/acme\.co/i).length).toBeGreaterThan(0)
  })

  it('swaps to the completed statement once verified', () => {
    render(
      <VerifyHeader domain="acme.co" projectName="Acme" variant="verified" />,
    )
    expect(screen.getByText(/is verified/)).toBeTruthy()
    expect(screen.getByText(/you can close this tab/i)).toBeTruthy()
    expect(screen.queryByText(/Verify ownership of/)).toBeNull()
  })

  it('adapts to a terminal failure, dropping the record-adding language', () => {
    render(
      <VerifyHeader domain="acme.co" projectName="Acme" variant="failed" />,
    )
    expect(screen.getByText(/didn.t go through/)).toBeTruthy()
    expect(
      screen.getByText(/ask them for a new verification link/i),
    ).toBeTruthy()
    expect(screen.queryByText(/add one DNS record/i)).toBeNull()
  })
})
