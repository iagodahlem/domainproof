import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerificationLog, VerificationLogStatus } from './verification-log'

describe('VerificationLog', () => {
  it('renders an entry with a human summary and a technical detail toggle', () => {
    render(
      <VerificationLog
        meta="1 entry"
        entries={[
          {
            id: '1',
            time: '14:02',
            summary: 'Looked for your TXT record — nothing there yet.',
            detail: (
              <>
                $ dig TXT _acmeapp-challenge.acme.co →{' '}
                <VerificationLogStatus tone="warn">
                  no record found
                </VerificationLogStatus>
              </>
            ),
          },
        ]}
      />,
    )
    expect(
      screen.getByText('Looked for your TXT record — nothing there yet.'),
    ).toBeTruthy()
    expect(screen.getByText('Technical detail')).toBeTruthy()
    expect(screen.getByText('no record found').className).toContain(
      'text-warning-strong',
    )
    expect(screen.getByText('1 entry')).toBeTruthy()
  })

  it('renders entries without a detail toggle when none is given', () => {
    render(
      <VerificationLog
        entries={[{ id: '1', time: '14:02', summary: 'All good.' }]}
      />,
    )
    expect(screen.getByText('All good.')).toBeTruthy()
    expect(screen.queryByText('Technical detail')).toBeNull()
  })

  it('shows an empty state when there are no entries', () => {
    render(<VerificationLog entries={[]} />)
    expect(screen.getByText('No checks yet.')).toBeTruthy()
  })

  it('accepts a custom empty state', () => {
    render(<VerificationLog entries={[]} emptyState="Nothing checked yet." />)
    expect(screen.getByText('Nothing checked yet.')).toBeTruthy()
  })
})

describe('VerificationLogStatus', () => {
  it('renders the ok tone', () => {
    render(
      <VerificationLogStatus tone="ok">record found</VerificationLogStatus>,
    )
    expect(screen.getByText('record found').className).toContain('text-success')
  })
})
