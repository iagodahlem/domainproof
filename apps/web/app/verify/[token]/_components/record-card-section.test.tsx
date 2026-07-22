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
  it('renders the host and value fields', () => {
    render(
      <RecordCardSection
        token="tok_1"
        records={RECORDS}
        provider="unknown"
        status="pending"
        cloudflareOutcome={null}
      />,
    )
    expect(screen.getByText('_acme-challenge.example.com')).toBeTruthy()
    expect(screen.getByText('acme-verify=abc123')).toBeTruthy()
  })

  it('shows the Cloudflare one-click button when the provider is cloudflare and not yet verified', () => {
    render(
      <RecordCardSection
        token="tok_1"
        records={RECORDS}
        provider="cloudflare"
        status="pending"
        cloudflareOutcome={null}
      />,
    )
    expect(screen.getByText('Add this record for me')).toBeTruthy()
  })

  it('hides the Cloudflare button once verified', () => {
    render(
      <RecordCardSection
        token="tok_1"
        records={RECORDS}
        provider="cloudflare"
        status="verified"
        cloudflareOutcome={null}
      />,
    )
    expect(screen.queryByText('Add this record for me')).toBeNull()
  })

  it('hides the Cloudflare button for a non-cloudflare provider', () => {
    render(
      <RecordCardSection
        token="tok_1"
        records={RECORDS}
        provider="unknown"
        status="pending"
        cloudflareOutcome={null}
      />,
    )
    expect(screen.queryByText('Add this record for me')).toBeNull()
  })

  it('renders an honest callout for a failure outcome even without the button', () => {
    render(
      <RecordCardSection
        token="tok_1"
        records={RECORDS}
        provider="unknown"
        status="pending"
        cloudflareOutcome="no_matching_zone"
      />,
    )
    expect(screen.getByText(/couldn't find this domain/i)).toBeTruthy()
  })
})
