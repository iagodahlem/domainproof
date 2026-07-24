import { describe, expect, it, vi } from 'vitest'
import type { DnsResolverLike } from './dns-probe'
import { runDkimProbe } from './dkim-probe'

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

describe('runDkimProbe', () => {
  it('detects a common selector that publishes a DKIM record', async () => {
    const resolver = fakeResolver({
      resolveTxt: vi.fn(async (hostname: string) => {
        if (hostname === 'google._domainkey.example.com') {
          return [['v=DKIM1; k=rsa; p=abc123']]
        }
        throw Object.assign(new Error('nxdomain'), { code: 'ENOTFOUND' })
      }),
    })

    const result = await runDkimProbe('example.com', resolver)

    expect(result.detectedSelectors).toEqual(['google'])
  })

  it('reports no selectors detected rather than throwing when every selector misses', async () => {
    const resolver = fakeResolver({
      resolveTxt: vi.fn(async () => {
        throw Object.assign(new Error('nxdomain'), { code: 'ENOTFOUND' })
      }),
    })

    const result = await runDkimProbe('no-dkim.example.com', resolver)

    expect(result.detectedSelectors).toEqual([])
  })
})
