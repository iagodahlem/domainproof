import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecordCardSection } from './record-card-section'

const RECORDS = [
  {
    label: '_acme-challenge.example.com',
    type: 'TXT',
    value: 'acme-verify=abc123',
  },
]

describe('RecordCardSection', () => {
  it('renders the host and value fields, truncating instead of wrapping', () => {
    render(<RecordCardSection domain="acme.co" records={RECORDS} />)
    expect(screen.getByText('_acme-challenge.example.com')).toBeTruthy()
    expect(screen.getByText('acme-verify=abc123')).toBeTruthy()
  })

  it('addresses the reader directly, naming the domain in question', () => {
    render(<RecordCardSection domain="acme.co" records={RECORDS} />)
    expect(
      screen.getByText('Add this where you manage DNS for acme.co'),
    ).toBeTruthy()
  })

  it('warns about a trailing dot some providers add automatically', () => {
    render(<RecordCardSection domain="acme.co" records={RECORDS} />)
    expect(screen.getByText(/trailing/i)).toBeTruthy()
  })
})
