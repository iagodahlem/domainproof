import { describe, expect, it } from 'vitest'
import { headerBreakdownCheck } from './header-breakdown'
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

describe('headerBreakdownCheck', () => {
  it('lists exactly which headers are missing', () => {
    const result = headerBreakdownCheck(
      ctxWith(fetchOk({ 'x-content-type-options': 'nosniff' })),
    )
    expect(result.detail).toContain('Content-Security-Policy')
    expect(result.detail).not.toContain('X-Content-Type-Options,')
  })

  it('reports every header present with no missing list', () => {
    const allHeaders = Object.fromEntries(
      [
        'strict-transport-security',
        'content-security-policy',
        'x-content-type-options',
        'x-frame-options',
        'referrer-policy',
        'permissions-policy',
        'cross-origin-opener-policy',
        'cross-origin-resource-policy',
        'cross-origin-embedder-policy',
        'x-xss-protection',
        'x-dns-prefetch-control',
        'x-permitted-cross-domain-policies',
      ].map((key) => [key, '1']),
    )
    const result = headerBreakdownCheck(ctxWith(fetchOk(allHeaders)))
    expect(result.status).toBe('pass')
    expect(result.detail).toBe('All recommended headers present.')
  })
})
