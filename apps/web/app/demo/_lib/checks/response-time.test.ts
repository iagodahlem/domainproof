import { describe, expect, it } from 'vitest'
import { responseTimeCheck } from './response-time'
import type { ProbeContext } from './context'

function ctxWith(fetchResult: ProbeContext['fetch']): ProbeContext {
  return {
    fetch: fetchResult,
    tls: { ok: false, reason: 'connection_error', message: 'n/a' },
    dns: { mx: [], txt: [], ns: [], caa: [], dmarcTxt: [] },
    dkim: { detectedSelectors: [] },
  }
}

function fetchOk(timingMs: number): ProbeContext['fetch'] {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    timingMs,
    finalUrl: 'https://example.com/',
    bodySample: '',
    setCookies: [],
  }
}

describe('responseTimeCheck', () => {
  it('passes a fast response', () => {
    expect(responseTimeCheck(ctxWith(fetchOk(120))).status).toBe('pass')
  })

  it('warns a slow-but-tolerable response', () => {
    expect(responseTimeCheck(ctxWith(fetchOk(800))).status).toBe('warn')
  })

  it('fails a very slow response', () => {
    expect(responseTimeCheck(ctxWith(fetchOk(3000))).status).toBe('fail')
  })

  it('fails when the request never completed', () => {
    const result = responseTimeCheck(
      ctxWith({ ok: false, reason: 'timeout', message: 'timed out' }),
    )
    expect(result.status).toBe('fail')
    expect(result.detail).toBe('timed out')
  })
})
