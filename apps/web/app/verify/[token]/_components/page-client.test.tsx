import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
  it('does not fire another verify check on mount when already verified, even with ?cloudflare=success in the URL', async () => {
    vi.spyOn(frontendApi, 'listVerificationEvents').mockResolvedValue({
      ok: true,
      data: { events: [], nextCursor: null },
    })
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

    // Give any effect a chance to fire before asserting the negative.
    await waitFor(() => {
      expect(frontendApi.listVerificationEvents).toHaveBeenCalled()
    })
    expect(runCheck).not.toHaveBeenCalled()
  })

  it('still fires the optimistic verify check once for a not-yet-verified domain with ?cloudflare=success', async () => {
    vi.spyOn(frontendApi, 'listVerificationEvents').mockResolvedValue({
      ok: true,
      data: { events: [], nextCursor: null },
    })
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
})
