import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerifyHeader } from './verify-header'

describe('VerifyHeader', () => {
  it('states the requester and the domain in one sentence', () => {
    render(
      <VerifyHeader domain="acme.co" projectName="Acme" verified={false} />,
    )
    expect(
      screen.getByText(/Acme asks you to verify ownership of/),
    ).toBeTruthy()
    expect(screen.getAllByText(/acme\.co/i).length).toBeGreaterThan(0)
  })

  it('swaps to the completed statement once verified', () => {
    render(<VerifyHeader domain="acme.co" projectName="Acme" verified={true} />)
    expect(screen.getByText(/is verified/)).toBeTruthy()
    expect(screen.getByText(/you can close this tab/i)).toBeTruthy()
    expect(screen.queryByText(/asks you to verify ownership of/)).toBeNull()
  })
})
