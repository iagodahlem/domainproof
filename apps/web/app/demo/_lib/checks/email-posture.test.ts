import { describe, expect, it } from 'vitest'
import { emailPostureCheck } from './email-posture'
import type { ProbeContext } from './context'

function ctxWith(
  dns: Partial<ProbeContext['dns']>,
  dkim: ProbeContext['dkim'] = { detectedSelectors: [] },
): ProbeContext {
  return {
    dns: { mx: [], txt: [], ns: [], caa: [], dmarcTxt: [], ...dns },
    dkim,
    fetch: { ok: false, reason: 'network_error', message: 'n/a' },
    tls: { ok: false, reason: 'connection_error', message: 'n/a' },
  }
}

describe('emailPostureCheck', () => {
  it('passes with SPF present and DMARC enforced', () => {
    const result = emailPostureCheck(
      ctxWith({
        txt: [['v=spf1 include:_spf.example.com ~all']],
        dmarcTxt: [['v=DMARC1; p=reject']],
      }),
    )
    expect(result.status).toBe('pass')
    expect(result.summary).toContain('SPF present')
    expect(result.summary).toContain('p=reject')
  })

  it('warns when DMARC policy is p=none', () => {
    const result = emailPostureCheck(
      ctxWith({
        txt: [['v=spf1 include:_spf.example.com ~all']],
        dmarcTxt: [['v=DMARC1; p=none']],
      }),
    )
    expect(result.status).toBe('warn')
  })

  it('fails when neither SPF nor DMARC is present', () => {
    const result = emailPostureCheck(ctxWith({}))
    expect(result.status).toBe('fail')
    expect(result.summary).toContain('SPF missing')
    expect(result.summary).toContain('DMARC missing')
  })

  it('labels a detected DKIM selector as best-effort', () => {
    const result = emailPostureCheck(
      ctxWith(
        {
          txt: [['v=spf1 ~all']],
          dmarcTxt: [['v=DMARC1; p=reject']],
        },
        { detectedSelectors: ['google'] },
      ),
    )
    expect(result.summary).toContain('DKIM detected (google, best-effort)')
  })
})
