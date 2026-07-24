import { describe, expect, it } from 'vitest'
import { cookieSecurityCheck } from './cookie-security'
import type { ProbeContext } from './context'

function ctxWith(setCookies: string[]): ProbeContext {
  return {
    fetch: {
      ok: true,
      status: 200,
      headers: new Headers(),
      timingMs: 100,
      finalUrl: 'https://example.com/',
      bodySample: '',
      setCookies,
    },
    tls: { ok: false, reason: 'connection_error', message: 'n/a' },
    dns: { mx: [], txt: [], ns: [], caa: [], dmarcTxt: [] },
    dkim: { detectedSelectors: [] },
  }
}

describe('cookieSecurityCheck', () => {
  it('passes when there are no cookies at all', () => {
    expect(cookieSecurityCheck(ctxWith([])).status).toBe('pass')
  })

  it('passes when every cookie sets Secure, HttpOnly, and SameSite', () => {
    const result = cookieSecurityCheck(
      ctxWith(['session=abc; Secure; HttpOnly; SameSite=Lax']),
    )
    expect(result.status).toBe('pass')
    expect(result.summary).toContain('session')
  })

  it('warns when some cookies are missing flags', () => {
    const result = cookieSecurityCheck(
      ctxWith([
        'session=abc; Secure; HttpOnly; SameSite=Lax',
        'tracking=xyz; Path=/',
      ]),
    )
    expect(result.status).toBe('warn')
  })

  it('fails when no cookie sets any of the flags', () => {
    const result = cookieSecurityCheck(ctxWith(['tracking=xyz; Path=/']))
    expect(result.status).toBe('fail')
  })

  it('fails when the fetch itself failed', () => {
    const result = cookieSecurityCheck({
      fetch: { ok: false, reason: 'timeout', message: 'timed out' },
      tls: { ok: false, reason: 'connection_error', message: 'n/a' },
      dns: { mx: [], txt: [], ns: [], caa: [], dmarcTxt: [] },
      dkim: { detectedSelectors: [] },
    })
    expect(result.status).toBe('fail')
  })
})
