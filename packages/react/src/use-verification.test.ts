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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(verification()),
    )
    // `autoPoll: false` isolates the initial read from the optimistic
    // check the default (`autoPoll: true`) behavior fires right after —
    // see the dedicated test for that below.
    const { result } = renderHook(() =>
      useVerification('ft_123', { autoPoll: false }),
    )

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.verification?.status).toBe('pending')
  })

  it('runs an optimistic check right after the initial read comes back non-terminal', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(jsonResponse(verification({ status: 'pending' }))),
      )

    renderHook(() => useVerification('ft_123'))

    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2),
    )
    const [, initialInit] = fetchMock.mock.calls[0] as [string, RequestInit?]
    const [, checkInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(initialInit?.method).not.toBe('POST')
    expect(checkInit.method).toBe('POST')
  })

  it('does not run an optimistic check when the initial read is already terminal', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(verification({ status: 'verified' })))

    const { result } = renderHook(() => useVerification('ft_123'))
    await waitFor(() => expect(result.current.status).toBe('success'))

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not run an optimistic check when autoPoll is false', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(verification({ status: 'pending' })))

    const { result } = renderHook(() =>
      useVerification('ft_123', { autoPoll: false }),
    )
    await waitFor(() => expect(result.current.status).toBe('success'))

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to a status read when a check is rate limited', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount += 1
      if (callCount === 2) {
        // The optimistic check — simulate an overlapping check having
        // already spent this token's 15s rate-limit window.
        return Promise.resolve(
          jsonResponse(
            { error: { code: 'rate_limited', message: 'Too many checks' } },
            429,
          ),
        )
      }
      return Promise.resolve(jsonResponse(verification({ status: 'pending' })))
    })

    const { result } = renderHook(() => useVerification('ft_123'))

    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(3))
    expect(result.current.status).toBe('success')
    expect(result.current.error).toBeNull()
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

  it('keeps polling while pending, driving real checks not passive reads', async () => {
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
    // wall-clock scheduling, not just the 5ms interval. >=3 covers the
    // initial read, the optimistic check right after it, and at least one
    // real poll tick beyond both.
    await waitFor(
      () => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3),
      { timeout: 2000 },
    )
    expect(result.current.verification?.status).toBe('pending')
    expect(result.current.isPolling).toBe(true)
    // Every call past the initial GET read — the optimistic check and
    // every poll tick after it — runs a real check, not a passive read.
    for (const call of fetchMock.mock.calls.slice(1)) {
      const [, init] = call as [string, RequestInit]
      expect(init.method).toBe('POST')
    }
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

    // `autoPoll: false` so the only two calls are the initial read and this
    // test's own explicit `verify()` — no automatic optimistic check
    // competing for the same two mocked responses.
    const { result } = renderHook(() =>
      useVerification('ft_123', { autoPoll: false }),
    )
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
