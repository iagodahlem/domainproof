import { describe, expect, it } from 'vitest'
import { techFingerprintCheck } from './tech-fingerprint'
import type { ProbeContext } from './context'

function ctxWith(fetchResult: ProbeContext['fetch']): ProbeContext {
  return {
    fetch: fetchResult,
    tls: { ok: false, reason: 'connection_error', message: 'n/a' },
    dns: { mx: [], txt: [], ns: [], caa: [], dmarcTxt: [] },
    dkim: { detectedSelectors: [] },
  }
}

function fetchOk(
  headers: Record<string, string>,
  bodySample = '',
): ProbeContext['fetch'] {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    timingMs: 100,
    finalUrl: 'https://example.com/',
    bodySample,
    setCookies: [],
  }
}

describe('techFingerprintCheck', () => {
  it('detects Next.js from a body marker', () => {
    const result = techFingerprintCheck(
      ctxWith(fetchOk({}, '<script>window.__NEXT_DATA__ = {}</script>')),
    )
    expect(result.status).toBe('pass')
    expect(result.summary).toContain('Next.js')
    expect(result.summary).toContain('basic fingerprint')
  })

  it('detects Cloudflare from a cf-ray header', () => {
    const result = techFingerprintCheck(
      ctxWith(fetchOk({ 'cf-ray': 'abc123' })),
    )
    expect(result.summary).toContain('Cloudflare')
  })

  it('detects a generic generator meta tag', () => {
    const result = techFingerprintCheck(
      ctxWith(fetchOk({}, '<meta name="generator" content="Ghost 5.0">')),
    )
    expect(result.summary).toContain('Ghost 5.0')
  })

  it('reports uncertainty rather than failing when nothing matches', () => {
    const result = techFingerprintCheck(ctxWith(fetchOk({})))
    expect(result.status).toBe('warn')
    expect(result.summary).toContain('confidently detect')
  })

  it('warns without failing when the fetch itself failed', () => {
    const result = techFingerprintCheck(
      ctxWith({ ok: false, reason: 'timeout', message: 'timed out' }),
    )
    expect(result.status).toBe('warn')
  })
})
