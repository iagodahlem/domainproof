import { describe, expect, it } from 'vitest'
import { createNodeFetchWebhookSender } from './webhook-sender'

const REQUEST = {
  url: 'https://example.com/webhooks/domainproof',
  body: '{"id":"evt_1"}',
  headers: { 'content-type': 'application/json' },
}

function abortableStub(): (
  input: string,
  init: RequestInit,
) => Promise<Response> {
  return (_input, init) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })
}

describe('createNodeFetchWebhookSender', () => {
  it('reports ok for a 2xx response', async () => {
    const fetchImpl = async () => new Response(null, { status: 200 })
    const sender = createNodeFetchWebhookSender({ fetchImpl })

    expect(await sender.send(REQUEST)).toEqual({ ok: true, status: 200 })
  })

  it('reports not-ok for a non-2xx response, without throwing', async () => {
    const fetchImpl = async () => new Response(null, { status: 500 })
    const sender = createNodeFetchWebhookSender({ fetchImpl })

    expect(await sender.send(REQUEST)).toEqual({ ok: false, status: 500 })
  })

  it('reports not-ok on timeout', async () => {
    const sender = createNodeFetchWebhookSender({
      timeoutMs: 10,
      fetchImpl: abortableStub(),
    })

    const result = await sender.send(REQUEST)
    expect(result.ok).toBe(false)
    expect(result.status).toBeUndefined()
    expect(result.error).toContain('Timed out')
  })

  it('reports not-ok on a network error, without throwing', async () => {
    const fetchImpl = async () => {
      throw new Error('connect ECONNREFUSED')
    }
    const sender = createNodeFetchWebhookSender({ fetchImpl })

    const result = await sender.send(REQUEST)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('connect ECONNREFUSED')
  })

  it('sends the given method, headers, and body verbatim', async () => {
    let seenInit: RequestInit | undefined
    const fetchImpl = async (_url: string, init: RequestInit) => {
      seenInit = init
      return new Response(null, { status: 204 })
    }
    const sender = createNodeFetchWebhookSender({ fetchImpl })

    await sender.send(REQUEST)

    expect(seenInit?.method).toBe('POST')
    expect(seenInit?.headers).toEqual(REQUEST.headers)
    expect(seenInit?.body).toBe(REQUEST.body)
  })
})
