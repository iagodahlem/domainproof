import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { runScan } from './run-scan'
import type { DnsResolverLike } from './probes/dns-probe'

class FakeSocket extends EventEmitter {
  destroy = vi.fn()
  getPeerCertificate = vi.fn(() => ({
    valid_to: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toUTCString(),
    issuer: { O: "Let's Encrypt" },
  }))
  getProtocol = vi.fn(() => 'TLSv1.3')
  authorized = true
}

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

function connectingTls() {
  return vi.fn(() => {
    const socket = new FakeSocket()
    queueMicrotask(() => socket.emit('secureConnect'))
    return socket as unknown as import('node:tls').TLSSocket
  })
}

// Stands in for real DNS so the TLS probe's resolve-then-vet step (see
// ssrf-guard.ts) doesn't depend on outbound network access in these tests.
const resolveToPublicAddress = async () => [
  { address: '93.184.216.34', family: 4 },
]

describe('runScan', () => {
  it('returns the unreachable outcome when DNS lookup fails, without running any probe', async () => {
    const fetchImpl = vi.fn()
    const result = await runScan('nx.example', {
      lookup: async () => {
        throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' })
      },
      fetchOptions: { fetchImpl: fetchImpl as unknown as typeof fetch },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected unreachable outcome')
    expect(result.reason).toBe('unreachable')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns the unreachable outcome when DNS resolves but nothing answers on 443', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const connect = vi.fn(() => {
      const socket = new FakeSocket()
      queueMicrotask(() => socket.emit('error', new Error('ECONNREFUSED')))
      return socket as unknown as import('node:tls').TLSSocket
    })

    const result = await runScan('down.example', {
      lookup: async () => ({ address: '203.0.113.1', family: 4 }),
      fetchOptions: { fetchImpl: fetchImpl as unknown as typeof fetch },
      tlsOptions: { connect, resolveAll: resolveToPublicAddress },
      dnsResolver: fakeResolver(),
    })

    expect(result.ok).toBe(false)
  })

  it('returns all 9 checks (4 teaser, 5 full) when the domain is reachable', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'x-content-type-options': 'nosniff' },
        }),
    )

    const result = await runScan('example.com', {
      lookup: async () => ({ address: '93.184.216.34', family: 4 }),
      fetchOptions: { fetchImpl: fetchImpl as unknown as typeof fetch },
      tlsOptions: {
        connect: connectingTls(),
        resolveAll: resolveToPublicAddress,
      },
      dnsResolver: fakeResolver({
        resolveMx: vi.fn(async () => [
          { exchange: 'mail.example.com', priority: 10 },
        ]),
      }),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok outcome')
    expect(result.report.domain).toBe('example.com')
    expect(result.report.checks).toHaveLength(9)
    expect(
      result.report.checks.filter((c) => c.tier === 'teaser'),
    ).toHaveLength(4)
    expect(result.report.checks.filter((c) => c.tier === 'full')).toHaveLength(
      5,
    )
    const ids = result.report.checks.map((c) => c.id)
    expect(new Set(ids).size).toBe(9)
  })

  it('still produces a report when the fetch fails but TLS succeeds', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('socket hang up')
    })

    const result = await runScan('flaky.example', {
      lookup: async () => ({ address: '203.0.113.2', family: 4 }),
      fetchOptions: { fetchImpl: fetchImpl as unknown as typeof fetch },
      tlsOptions: {
        connect: connectingTls(),
        resolveAll: resolveToPublicAddress,
      },
      dnsResolver: fakeResolver(),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok outcome')
    const tlsCheck = result.report.checks.find((c) => c.id === 'https-tls')
    const headersCheck = result.report.checks.find(
      (c) => c.id === 'security-headers',
    )
    expect(tlsCheck?.status).toBe('pass')
    expect(headersCheck?.status).toBe('fail')
  })
})
