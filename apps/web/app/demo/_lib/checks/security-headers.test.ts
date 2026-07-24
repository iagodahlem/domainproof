import { describe, expect, it } from 'vitest'
import { securityHeadersCheck } from './security-headers'
import type { ProbeContext } from './context'

function ctxWith(fetchResult: ProbeContext['fetch']): ProbeContext {
  return {
    fetch: fetchResult,
    tls: { ok: false, reason: 'connection_error', message: 'n/a' },
    dns: { mx: [], txt: [], ns: [], caa: [], dmarcTxt: [] },
    dkim: { detectedSelectors: [] },
  }
}

function fetchOk(headers: Record<string, string>): ProbeContext['fetch'] {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    timingMs: 100,
    finalUrl: 'https://example.com/',
    bodySample: '',
    setCookies: [],
  }
}

describe('securityHeadersCheck', () => {
  it('passes when most recommended headers are present', () => {
    const result = securityHeadersCheck(
      ctxWith(
        fetchOk({
          'strict-transport-security': 'max-age=63072000',
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'no-referrer',
          'permissions-policy': 'geolocation=()',
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-resource-policy': 'same-origin',
          'cross-origin-embedder-policy': 'require-corp',
        }),
      ),
    )
    expect(result.status).toBe('pass')
    expect(result.summary).toBe('9 of 12 recommended headers present')
  })

  it('warns when a moderate number of headers are present', () => {
    const result = securityHeadersCheck(
      ctxWith(
        fetchOk({
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'no-referrer',
        }),
      ),
    )
    expect(result.status).toBe('warn')
    expect(result.summary).toBe('3 of 12 recommended headers present')
  })

  it('fails when almost no headers are present', () => {
    const result = securityHeadersCheck(
      ctxWith(fetchOk({ 'x-content-type-options': 'nosniff' })),
    )
    expect(result.status).toBe('fail')
    expect(result.summary).toBe('1 of 12 recommended headers present')
  })

  it('fails when the site could not be fetched', () => {
    const result = securityHeadersCheck(
      ctxWith({ ok: false, reason: 'timeout', message: 'timed out' }),
    )
    expect(result.status).toBe('fail')
    expect(result.detail).toBe('timed out')
  })
})
