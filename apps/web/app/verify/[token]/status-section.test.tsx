import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Verification } from '../../../lib/frontend-api'
import * as frontendApi from '../../../lib/frontend-api'
import { StatusSection } from './status-section'

function verification(overrides: Partial<Verification> = {}): Verification {
  return {
    domain: 'acme.co',
    mode: 'live',
    status: 'pending',
    projectName: 'Acme',
    provider: 'unknown',
    records: [],
    check: null,
    updatedAt: '2026-07-19T12:00:00.000Z',
    ...overrides,
  }
}

describe('StatusSection', () => {
  it('renders pending guidance and a recheck button', () => {
    render(
      <StatusSection
        token="tok_1"
        data={verification()}
        onDataChange={() => {}}
        isPolling={false}
        pollError={null}
      />,
    )
    expect(screen.getByText(/waiting for your dns record/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recheck now' })).toBeTruthy()
  })

  it('renders the verified success state with no recheck button', () => {
    render(
      <StatusSection
        token="tok_1"
        data={verification({
          status: 'verified',
          check: { outcome: 'found', checkedAt: '2026-07-19T12:00:00.000Z' },
        })}
        onDataChange={() => {}}
        isPolling={false}
        pollError={null}
      />,
    )
    expect(screen.getByText('Domain verified')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Recheck now' })).toBeNull()
  })

  it('renders the expected/detected diff for a failed wrong_value check', () => {
    render(
      <StatusSection
        token="tok_1"
        data={verification({
          status: 'failed',
          check: {
            outcome: 'wrong_value',
            checkedAt: '2026-07-19T12:00:00.000Z',
            expected: 'acme-verify=correct',
            detected: ['acme-verify=wrong'],
          },
        })}
        onDataChange={() => {}}
        isPolling={false}
        pollError={null}
      />,
    )
    expect(screen.getByText(/acme-verify=correct/)).toBeTruthy()
    expect(screen.getByText(/acme-verify=wrong/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Recheck now' })).toBeNull()
  })

  it('renders a friendly message and no crash on a 429 recheck response', async () => {
    const user = userEvent.setup()
    vi.spyOn(frontendApi, 'runVerificationCheck').mockResolvedValue({
      ok: false,
      error: {
        kind: 'http',
        status: 429,
        code: 'rate_limited',
        message: 'Too many requests',
      },
    })

    render(
      <StatusSection
        token="tok_1"
        data={verification()}
        onDataChange={() => {}}
        isPolling={false}
        pollError={null}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Recheck now' }))
    expect(await screen.findByText(/give it a few seconds/i)).toBeTruthy()
  })

  it('surfaces a poll error banner without hiding the current status', () => {
    render(
      <StatusSection
        token="tok_1"
        data={verification()}
        onDataChange={() => {}}
        isPolling={false}
        pollError="We're having trouble reaching DomainProof — we'll keep trying."
      />,
    )
    expect(screen.getByText(/trouble reaching domainproof/i)).toBeTruthy()
    expect(screen.getByText(/waiting for your dns record/i)).toBeTruthy()
  })
})
