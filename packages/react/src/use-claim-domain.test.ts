import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useClaimDomain } from './use-claim-domain'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const CLAIM_RESULT = {
  domain: 'acme.test',
  mode: 'test' as const,
  status: 'pending' as const,
  projectName: 'Acme',
  provider: 'unknown' as const,
  records: [{ label: '_acme-challenge.acme.test', type: 'TXT', value: 'x' }],
  check: null,
  updatedAt: '2026-07-19T12:00:00.000Z',
  frontendToken: 'ft_123',
}

describe('useClaimDomain', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('claims a domain and exposes the result', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(CLAIM_RESULT, 201))

    const { result } = renderHook(() => useClaimDomain('sess_123'))
    expect(result.current.status).toBe('idle')

    let returned: unknown
    await act(async () => {
      returned = await result.current.claim('acme.test')
    })

    expect(returned).toEqual(CLAIM_RESULT)
    expect(result.current.status).toBe('success')
    expect(result.current.data).toEqual(CLAIM_RESULT)
    expect(result.current.error).toBeNull()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://frontend.api.domainproof.dev/frontend/component-sessions/sess_123/claim',
    )
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ domain: 'acme.test' })
  })

  it('surfaces an http error without touching data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        { error: { code: 'not_found', message: 'Component session not found' } },
        404,
      ),
    )

    const { result } = renderHook(() => useClaimDomain('sess_expired'))

    let returned: unknown
    await act(async () => {
      returned = await result.current.claim('acme.test')
    })

    expect(returned).toBeNull()
    expect(result.current.status).toBe('error')
    expect(result.current.data).toBeNull()
    expect(result.current.error).toEqual({
      kind: 'http',
      status: 404,
      code: 'not_found',
      message: 'Component session not found',
    })
  })

  it('surfaces a network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useClaimDomain('sess_123'))

    await act(async () => {
      await result.current.claim('acme.test')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toEqual({ kind: 'network', message: 'offline' })
  })

  it('reset clears status, data, and error back to idle', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(CLAIM_RESULT, 201))

    const { result } = renderHook(() => useClaimDomain('sess_123'))
    await act(async () => {
      await result.current.claim('acme.test')
    })
    expect(result.current.status).toBe('success')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('uses the baseUrl option over the production default', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(CLAIM_RESULT, 201))

    const { result } = renderHook(() =>
      useClaimDomain('sess_123', { baseUrl: 'http://localhost:3001' }),
    )
    await act(async () => {
      await result.current.claim('acme.test')
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url.startsWith('http://localhost:3001/')).toBe(true)
  })
})
