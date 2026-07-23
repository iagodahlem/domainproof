import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useVerification } from './use-verification'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function verification(overrides: Record<string, unknown> = {}) {
  return {
    domain: 'acme.test',
    mode: 'test',
    status: 'pending',
    projectName: 'Acme',
    provider: 'unknown',
    records: [{ label: '_acme-challenge.acme.test', type: 'TXT', value: 'x' }],
    check: null,
    updatedAt: '2026-07-19T12:00:00.000Z',
    ...overrides,
  }
}

describe('useVerification', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing when token is null', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useVerification(null))
    expect(result.current.status).toBe('idle')
    expect(result.current.verification).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches once on mount when a token is provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(verification()))
    const { result } = renderHook(() => useVerification('ft_123'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.verification?.status).toBe('pending')
  })

  it('does not poll once status is terminal', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(verification({ status: 'verified' })),
    )
    const { result } = renderHook(() => useVerification('ft_123'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.isPolling).toBe(false)
  })

  it('keeps polling while pending', async () => {
    // A `Response` body can only be read once — `mockResolvedValue` would
    // reuse the same instance for every call, so the second `.json()) read
    // throws (swallowed by `client.ts`'s `.catch(() => null)`) and silently
    // nulls out `verification`. `mockImplementation` builds a fresh one per
    // call instead.
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(jsonResponse(verification({ status: 'pending' }))),
      )

    const { result } = renderHook(() =>
      useVerification('ft_123', { intervalsMs: [5] }),
    )

    // Real-timer polling, so assert on an eventual call count rather than
    // an exact one — how many ticks land before this resolves depends on
    // wall-clock scheduling, not just the 5ms interval. >=2 is enough to
    // prove the poll loop fired at least once beyond the initial read.
    await waitFor(
      () => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2),
      { timeout: 2000 },
    )
    expect(result.current.verification?.status).toBe('pending')
    expect(result.current.isPolling).toBe(true)
  })

  it('stops polling for good once verified', async () => {
    let callCount = 0
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount += 1
      return Promise.resolve(
        jsonResponse(
          verification({ status: callCount === 1 ? 'pending' : 'verified' }),
        ),
      )
    })

    const { result } = renderHook(() =>
      useVerification('ft_123', { intervalsMs: [5] }),
    )

    await waitFor(() =>
      expect(result.current.verification?.status).toBe('verified'),
    )
    await waitFor(() => expect(result.current.isPolling).toBe(false))

    const callsAtVerified = fetchMock.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchMock.mock.calls.length).toBe(callsAtVerified)
  })

  it('does not poll when autoPoll is false', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(verification({ status: 'pending' })))

    const { result } = renderHook(() =>
      useVerification('ft_123', { autoPoll: false, intervalsMs: [5] }),
    )

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.isPolling).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('verify() runs the check and updates verification', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(verification({ status: 'pending' })))
      .mockResolvedValueOnce(jsonResponse(verification({ status: 'verified' })))

    const { result } = renderHook(() => useVerification('ft_123'))
    await waitFor(() => expect(result.current.status).toBe('success'))

    await act(async () => {
      await result.current.verify()
    })

    expect(result.current.verification?.status).toBe('verified')
    const [, checkInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(checkInit.method).toBe('POST')
    expect(result.current.isVerifying).toBe(false)
  })

  it('surfaces an http error from the initial fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        { error: { code: 'not_found', message: 'Verification not found' } },
        404,
      ),
    )

    const { result } = renderHook(() => useVerification('ft_bad'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toEqual({
      kind: 'http',
      status: 404,
      code: 'not_found',
      message: 'Verification not found',
    })
  })
})
