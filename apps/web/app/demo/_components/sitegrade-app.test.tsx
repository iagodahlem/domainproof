import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRouter, useSearchParams } from 'next/navigation'
import { SitegradeApp } from './sitegrade-app'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}))

// The embedded widget (and its compiled stylesheet, which vitest's CSS
// pipeline can't process here) is out of scope — this suite only exercises
// the surrounding page's own status poll.
vi.mock('./verify-gate', () => ({
  VerifyGate: () => null,
}))

const mockUseRouter = vi.mocked(useRouter)
const mockUseSearchParams = vi.mocked(useSearchParams)

const SCAN_SUCCESS = {
  scanId: 'scan_1',
  domain: 'acme.test',
  grade: 'B',
  gradeLabel: 'Solid, a few gaps',
  teaser: [],
}

const CLAIM_SUCCESS = {
  domainId: 'dom_1',
  domain: 'acme.test',
  hostedUrl: 'https://domainproof.dev/verify/tok_1',
  frontendToken: 'ft_1',
  sessionToken: null,
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function pendingStatusResponse() {
  return {
    claimed: true,
    verified: false,
    verifiedAt: null,
    fullReport: null,
    frontendToken: 'ft_1',
    hostedUrl: 'https://domainproof.dev/verify/tok_1',
  }
}

/** Routes the demo's own API calls — scan, claim, and status — the only fetches this component ever makes. */
function mockDemoFetch() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url === '/demo/api/scan' && method === 'POST') {
        return Promise.resolve(jsonResponse(SCAN_SUCCESS))
      }
      if (url === '/demo/api/claim' && method === 'POST') {
        return Promise.resolve(jsonResponse(CLAIM_SUCCESS))
      }
      if (url.startsWith('/demo/api/status')) {
        return Promise.resolve(jsonResponse(pendingStatusResponse()))
      }
      return Promise.reject(
        new Error(`Unhandled fetch in test: ${method} ${url}`),
      )
    })
}

/** Drives the app from the empty scan form to a claimed, still-pending report — the state the status poll runs in. */
async function scanAndClaim() {
  render(<SitegradeApp />)

  fireEvent.change(screen.getByLabelText('Domain to scan'), {
    target: { value: 'acme.test' },
  })
  fireEvent.click(screen.getByRole('button', { name: /scan for free/i }))

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2_000)
  })
}

function statusCallCount(fetchMock: ReturnType<typeof mockDemoFetch>) {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).startsWith('/demo/api/status'),
  ).length
}

describe('SitegradeApp status poll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseRouter.mockReturnValue({
      replace: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>)
    mockUseSearchParams.mockReturnValue({
      get: () => null,
    } as unknown as ReturnType<typeof useSearchParams>)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps checking status past STATUS_POLL_MAX_ATTEMPTS instead of going silent', async () => {
    const fetchMock = mockDemoFetch()
    await scanAndClaim()

    expect(statusCallCount(fetchMock)).toBeGreaterThan(0)

    await act(async () => {
      // 40 attempts on the 5s ladder, plus slack.
      await vi.advanceTimersByTimeAsync(205_000)
    })
    const callsAtMaxAttempts = statusCallCount(fetchMock)
    expect(callsAtMaxAttempts).toBeGreaterThan(40)

    await act(async () => {
      // A long-tail tick (60s) plus slack — proves it's still alive, just slow.
      await vi.advanceTimersByTimeAsync(65_000)
    })
    expect(statusCallCount(fetchMock)).toBeGreaterThan(callsAtMaxAttempts)
  })

  it('re-checks status immediately when the window regains focus', async () => {
    const fetchMock = mockDemoFetch()
    await scanAndClaim()

    const callsBeforeFocus = statusCallCount(fetchMock)

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(statusCallCount(fetchMock)).toBeGreaterThan(callsBeforeFocus)
  })
})
