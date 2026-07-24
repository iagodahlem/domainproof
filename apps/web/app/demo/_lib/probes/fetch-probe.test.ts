import { describe, expect, it, vi } from 'vitest'
import { runFetchProbe } from './fetch-probe'

function textStreamResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, init)
}

describe('runFetchProbe', () => {
  it('returns headers, status, timing, and a body sample on success', async () => {
    const fetchImpl = vi.fn(async () =>
      textStreamResponse('<html><body>hi</body></html>', {
        status: 200,
        headers: { 'x-test': 'yes' },
      }),
    )

    const result = await runFetchProbe('example.com', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.status).toBe(200)
    expect(result.headers.get('x-test')).toBe('yes')
    expect(result.bodySample).toContain('hi')
    expect(result.timingMs).toBeGreaterThanOrEqual(0)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/',
      expect.objectContaining({ redirect: 'follow' }),
    )
  })

  it('reports a network error as a failure, not a throw', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND example.invalid')
    })

    const result = await runFetchProbe('example.invalid', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'network_error',
      message: 'getaddrinfo ENOTFOUND example.invalid',
    })
  })

  it('reports an abort as a timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('This operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )

    const result = await runFetchProbe('slow.example', {
      timeoutMs: 5,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'timeout',
      message: 'This operation was aborted',
    })
  })

  it('caps the body sample rather than buffering the whole response', async () => {
    const big = 'x'.repeat(50_000)
    const fetchImpl = vi.fn(async () =>
      textStreamResponse(big, { status: 200 }),
    )

    const result = await runFetchProbe('example.com', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.bodySample.length).toBeLessThan(big.length)
  })
})
