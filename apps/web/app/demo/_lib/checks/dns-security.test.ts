import { describe, expect, it } from 'vitest'
import { dnsSecurityCheck } from './dns-security'
import type { ProbeContext } from './context'

function ctxWith(caa: ProbeContext['dns']['caa']): ProbeContext {
  return {
    dns: { mx: [], txt: [], ns: [], caa, dmarcTxt: [] },
    fetch: { ok: false, reason: 'network_error', message: 'n/a' },
    tls: { ok: false, reason: 'connection_error', message: 'n/a' },
    dkim: { detectedSelectors: [] },
  }
}

describe('dnsSecurityCheck', () => {
  it('warns (never fails) when no CAA record is present', () => {
    const result = dnsSecurityCheck(ctxWith([]))
    expect(result.status).toBe('warn')
  })

  it('passes and names the authorized issuer when CAA is present', () => {
    const result = dnsSecurityCheck(
      ctxWith([{ critical: 0, issue: 'letsencrypt.org' }]),
    )
    expect(result.status).toBe('pass')
    expect(result.summary).toContain('letsencrypt.org')
  })
})
