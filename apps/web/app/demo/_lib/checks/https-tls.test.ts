import { describe, expect, it } from 'vitest'
import { httpsTlsCheck } from './https-tls'
import type { ProbeContext } from './context'

function ctxWith(tls: ProbeContext['tls']): ProbeContext {
  return {
    tls,
    fetch: { ok: false, reason: 'network_error', message: 'n/a' },
    dns: { mx: [], txt: [], ns: [], caa: [], dmarcTxt: [] },
    dkim: { detectedSelectors: [] },
  }
}

describe('httpsTlsCheck', () => {
  it('passes a valid, long-lived certificate', () => {
    const result = httpsTlsCheck(
      ctxWith({
        ok: true,
        protocol: 'TLSv1.3',
        issuer: "Let's Encrypt",
        validTo: new Date().toISOString(),
        daysUntilExpiry: 68,
        authorized: true,
      }),
    )
    expect(result.status).toBe('pass')
    expect(result.summary).toContain("Let's Encrypt")
    expect(result.summary).toContain('68 days')
  })

  it('warns when the certificate is close to expiry', () => {
    const result = httpsTlsCheck(
      ctxWith({
        ok: true,
        protocol: 'TLSv1.3',
        issuer: "Let's Encrypt",
        validTo: new Date().toISOString(),
        daysUntilExpiry: 5,
        authorized: true,
      }),
    )
    expect(result.status).toBe('warn')
  })

  it('fails an expired certificate', () => {
    const result = httpsTlsCheck(
      ctxWith({
        ok: true,
        protocol: 'TLSv1.3',
        issuer: "Let's Encrypt",
        validTo: new Date().toISOString(),
        daysUntilExpiry: -3,
        authorized: true,
      }),
    )
    expect(result.status).toBe('fail')
    expect(result.summary).toContain('expired')
  })

  it('fails an untrusted certificate even if not expired', () => {
    const result = httpsTlsCheck(
      ctxWith({
        ok: true,
        protocol: 'TLSv1.3',
        issuer: 'Self-signed',
        validTo: new Date().toISOString(),
        daysUntilExpiry: 300,
        authorized: false,
      }),
    )
    expect(result.status).toBe('fail')
    expect(result.summary).toContain('not trusted')
  })

  it('fails when the TLS probe itself failed', () => {
    const result = httpsTlsCheck(
      ctxWith({
        ok: false,
        reason: 'timeout',
        message: 'TLS handshake timed out',
      }),
    )
    expect(result.status).toBe('fail')
    expect(result.detail).toBe('TLS handshake timed out')
  })
})
