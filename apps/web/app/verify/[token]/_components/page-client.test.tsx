import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Verification } from '@/lib/api/frontend'
// eslint-disable-next-line no-restricted-imports -- test spies on the frontend plane client's export, same exception as page-client.tsx
import * as frontendApi from '@/lib/api/frontend'
import { VerificationPageClient } from './page-client'

function verification(overrides: Partial<Verification> = {}): Verification {
  return {
    domain: 'acme.co',
    mode: 'live',
    status: 'pending',
    projectName: 'Acme',
    provider: 'cloudflare',
    records: [
      {
        label: '_acme-challenge.acme.co',
        type: 'TXT',
        value: 'acme-verify=abc123',
      },
    ],
    check: null,
    updatedAt: '2026-07-19T12:00:00.000Z',
    ...overrides,
  }
}

describe('VerificationPageClient', () => {
  it('does not fire another verify check on mount when already verified, even with ?cloudflare=success in the URL', () => {
    const runCheck = vi
      .spyOn(frontendApi, 'runVerificationCheck')
      .mockResolvedValue({
        ok: true,
        data: verification({ status: 'verified' }),
      })

    render(
      <VerificationPageClient
        token="tok_1"
        initialData={verification({ status: 'verified' })}
        cloudflareOutcome="success"
      />,
    )

    // The guard is a synchronous check at effect time — no async work to
    // await before asserting it never ran.
    expect(runCheck).not.toHaveBeenCalled()
  })

  it('still fires the optimistic verify check once for a not-yet-verified domain with ?cloudflare=success', async () => {
    const runCheck = vi
      .spyOn(frontendApi, 'runVerificationCheck')
      .mockResolvedValue({
        ok: true,
        data: verification({ status: 'verified' }),
      })

    render(
      <VerificationPageClient
        token="tok_1"
        initialData={verification({ status: 'pending' })}
        cloudflareOutcome="success"
      />,
    )

    await waitFor(() => {
      expect(runCheck).toHaveBeenCalledTimes(1)
    })
    expect(runCheck).toHaveBeenCalledWith('tok_1')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats a non-network poll error (e.g. a 404 from a domain deleted mid-session) as terminal', async () => {
    vi.useFakeTimers()
    vi.spyOn(frontendApi, 'getVerification').mockResolvedValue({
      ok: false,
      error: {
        kind: 'http',
        status: 404,
        code: 'not_found',
        message: 'Not found',
      },
    })

    render(
      <VerificationPageClient
        token="tok_1"
        initialData={verification({ status: 'pending' })}
        cloudflareOutcome={null}
      />,
    )

    expect(screen.getByText('Checking automatically, every 20s.')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(screen.getByText(/this verification link expired/i)).toBeTruthy()
    expect(screen.queryByText('Checking automatically, every 20s.')).toBeNull()
  })

  it('does not treat a network error on the poll path as terminal', async () => {
    vi.useFakeTimers()
    vi.spyOn(frontendApi, 'getVerification').mockResolvedValue({
      ok: false,
      error: { kind: 'network', message: 'fetch failed' },
    })

    render(
      <VerificationPageClient
        token="tok_1"
        initialData={verification({ status: 'pending' })}
        cloudflareOutcome={null}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(
      screen.getByText(/having trouble reaching domainproof/i),
    ).toBeTruthy()
    expect(screen.queryByText(/this verification link expired/i)).toBeNull()
  })
})
