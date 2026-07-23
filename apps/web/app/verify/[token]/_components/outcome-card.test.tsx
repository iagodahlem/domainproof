import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OutcomeCard } from './outcome-card'

describe('OutcomeCard', () => {
  it('renders the heading and body for a success outcome', () => {
    render(
      <OutcomeCard
        tone="success"
        heading="Domain verified"
        body="acme.co is verified."
        check={null}
      />,
    )
    expect(screen.getByText('Domain verified')).toBeTruthy()
    expect(screen.getByText('acme.co is verified.')).toBeTruthy()
  })

  it('renders the expected/found diff when a check is passed', () => {
    render(
      <OutcomeCard
        tone="danger"
        heading="We found the wrong value"
        body="The TXT record didn't match."
        check={{
          expected: 'acme-verify=correct',
          detected: ['acme-verify=wrong'],
        }}
      />,
    )
    expect(screen.getByText('acme-verify=correct')).toBeTruthy()
    expect(screen.getByText('acme-verify=wrong')).toBeTruthy()
  })

  it('omits the diff box when no check is passed', () => {
    render(
      <OutcomeCard
        tone="warning"
        heading="Your DNS record changed"
        body="Add the record again."
        check={null}
      />,
    )
    expect(screen.queryByText('Expected')).toBeNull()
  })

  it('falls back to an em dash when nothing was detected', () => {
    render(
      <OutcomeCard
        tone="danger"
        heading="We found the wrong value"
        body="The TXT record didn't match."
        check={{ expected: 'acme-verify=correct', detected: [] }}
      />,
    )
    expect(screen.getByText('—')).toBeTruthy()
  })
})
