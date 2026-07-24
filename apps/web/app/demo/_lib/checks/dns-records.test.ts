import { describe, expect, it } from 'vitest'
import { dnsRecordsCheck } from './dns-records'
import type { ProbeContext } from './context'

function ctxWith(dns: ProbeContext['dns']): ProbeContext {
  return {
    dns,
    fetch: { ok: false, reason: 'network_error', message: 'n/a' },
    tls: { ok: false, reason: 'connection_error', message: 'n/a' },
    dkim: { detectedSelectors: [] },
  }
}

describe('dnsRecordsCheck', () => {
  it('passes when MX, SPF, and DMARC are all present', () => {
    const result = dnsRecordsCheck(
      ctxWith({
        mx: ['mail.example.com'],
        txt: [['v=spf1 include:_spf.example.com ~all']],
        ns: [],
        caa: [],
        dmarcTxt: [['v=DMARC1; p=reject']],
      }),
    )
    expect(result.status).toBe('pass')
    expect(result.summary).toBe('MX, SPF, DMARC found')
  })

  it('warns when only some mail records are present', () => {
    const result = dnsRecordsCheck(
      ctxWith({
        mx: ['mail.example.com'],
        txt: [['v=spf1 include:_spf.example.com ~all']],
        ns: [],
        caa: [],
        dmarcTxt: [],
      }),
    )
    expect(result.status).toBe('warn')
    expect(result.summary).toBe('MX & SPF found · DMARC not set')
  })

  it('fails when no mail records are present', () => {
    const result = dnsRecordsCheck(
      ctxWith({ mx: [], txt: [], ns: [], caa: [], dmarcTxt: [] }),
    )
    expect(result.status).toBe('fail')
    expect(result.summary).toBe(
      'No mail records found · MX, SPF, DMARC not set',
    )
  })
})
