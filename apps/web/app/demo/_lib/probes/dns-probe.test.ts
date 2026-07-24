import { describe, expect, it, vi } from 'vitest'
import type { DnsResolverLike } from './dns-probe'
import { runDnsProbe } from './dns-probe'

function fakeResolver(
  overrides: Partial<DnsResolverLike> = {},
): DnsResolverLike {
  return {
    resolveMx: vi.fn(async () => []),
    resolveTxt: vi.fn(async () => []),
    resolveNs: vi.fn(async () => []),
    resolveCaa: vi.fn(async () => []),
    ...overrides,
  } as DnsResolverLike
}

describe('runDnsProbe', () => {
  it('resolves MX, TXT, NS, CAA, and the _dmarc TXT record', async () => {
    const resolveTxt = vi.fn(async (hostname: string) => {
      if (hostname === '_dmarc.example.com') {
        return [['v=DMARC1; p=reject']]
      }
      return [['v=spf1 include:_spf.example.com ~all']]
    })
    const resolver = fakeResolver({
      resolveMx: vi.fn(async () => [
        { exchange: 'mail.example.com', priority: 10 },
      ]),
      resolveTxt,
      resolveNs: vi.fn(async () => ['ns1.example.com', 'ns2.example.com']),
      resolveCaa: vi.fn(async () => [
        { critical: 0, issue: 'letsencrypt.org' },
      ]),
    })

    const result = await runDnsProbe('example.com', resolver)

    expect(result.mx).toEqual(['mail.example.com'])
    expect(result.ns).toEqual(['ns1.example.com', 'ns2.example.com'])
    expect(result.caa).toEqual([{ critical: 0, issue: 'letsencrypt.org' }])
    expect(result.txt).toEqual([['v=spf1 include:_spf.example.com ~all']])
    expect(result.dmarcTxt).toEqual([['v=DMARC1; p=reject']])
    expect(resolveTxt).toHaveBeenCalledWith('example.com')
    expect(resolveTxt).toHaveBeenCalledWith('_dmarc.example.com')
  })

  it('treats a lookup miss on any record type as empty, not a throw', async () => {
    const resolver = fakeResolver({
      resolveMx: vi.fn(async () => {
        throw Object.assign(new Error('queryMx ENOTFOUND'), {
          code: 'ENOTFOUND',
        })
      }),
    })

    const result = await runDnsProbe('no-mx.example.com', resolver)

    expect(result.mx).toEqual([])
  })
})
