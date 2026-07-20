import { describe, expect, it } from 'vitest'

import type { TxtResolutionFailureReason } from '@domainproof/core'

import type { CreateNodeDnsClient, NodeDnsClient } from './node-dns'
import {
  createNodeDnsResolver,
  discoverAuthoritativeNameservers,
} from './node-dns'

const HOST = '_domainproof-challenge.example.com'

/**
 * Per-server-list behavior for the fake DNS client below, keyed by the first
 * address passed to `setServers`. That's enough to distinguish "the public
 * resolver" (keyed by its first configured IP, e.g. `1.1.1.1`) from "an
 * authoritative server" (keyed by its own IP) without any real network IO.
 */
interface ClientScript {
  resolveNs?: (hostname: string) => Promise<string[]>
  resolve4?: (hostname: string) => Promise<string[]>
  resolveTxt?: (hostname: string) => Promise<string[][]>
}

function dnsError(code: string): Error {
  const error = new Error(code) as Error & { code: string }
  error.code = code
  return error
}

/**
 * Builds a fake {@link CreateNodeDnsClient} from a map of scripts, and
 * returns the factory alongside a log of every server list a TXT query was
 * attempted against (in order) — enough to assert both the outcome and the
 * exact authoritative/fallback ladder that produced it.
 */
function createFakeDns(scripts: Record<string, ClientScript>): {
  factory: CreateNodeDnsClient
  txtAttempts: string[][]
} {
  const txtAttempts: string[][] = []

  const factory: CreateNodeDnsClient = () => {
    let servers: readonly string[] = []

    const scriptForCurrentServers = (): ClientScript | undefined =>
      scripts[servers[0] ?? '']

    const client: NodeDnsClient = {
      setServers(newServers) {
        servers = newServers
      },
      async resolveNs(hostname) {
        const script = scriptForCurrentServers()
        if (!script?.resolveNs) {
          throw dnsError('ENOTFOUND')
        }
        return script.resolveNs(hostname)
      },
      async resolve4(hostname) {
        const script = scriptForCurrentServers()
        if (!script?.resolve4) {
          throw dnsError('ENOTFOUND')
        }
        return script.resolve4(hostname)
      },
      async resolveTxt(hostname) {
        txtAttempts.push([...servers])
        const script = scriptForCurrentServers()
        if (!script?.resolveTxt) {
          throw dnsError('ENOTFOUND')
        }
        return script.resolveTxt(hostname)
      },
    }

    return client
  }

  return { factory, txtAttempts }
}

describe('createNodeDnsResolver', () => {
  it('resolves TXT via the authoritative path when NS discovery succeeds', async () => {
    const { factory, txtAttempts } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => ['ns1.example.com', 'ns2.example.com'],
        resolve4: async (host) =>
          host === 'ns1.example.com' ? ['203.0.113.1'] : ['203.0.113.2'],
      },
      '203.0.113.1': {
        resolveTxt: async () => [['domainproof-verify=abc']],
      },
    })

    const resolver = createNodeDnsResolver({ dns: factory })
    const result = await resolver.resolveTxt(HOST)

    expect(result).toEqual({ ok: true, records: ['domainproof-verify=abc'] })
    expect(txtAttempts).toEqual([['203.0.113.1']])
  })

  it('falls back to the public resolver when NS discovery fails entirely', async () => {
    const { factory, txtAttempts } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => {
          throw dnsError('ESERVFAIL')
        },
        resolveTxt: async () => [['domainproof-verify=fallback']],
      },
    })

    const resolver = createNodeDnsResolver({ dns: factory })
    const result = await resolver.resolveTxt(HOST)

    expect(result).toEqual({
      ok: true,
      records: ['domainproof-verify=fallback'],
    })
    expect(txtAttempts).toEqual([['1.1.1.1', '8.8.8.8']])
  })

  it('falls back to the public resolver when every authoritative attempt errors', async () => {
    const { factory, txtAttempts } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => ['ns1.example.com'],
        resolve4: async () => ['203.0.113.1'],
        resolveTxt: async () => [['domainproof-verify=fallback']],
      },
      '203.0.113.1': {
        resolveTxt: async () => {
          throw dnsError('ESERVFAIL')
        },
      },
    })

    const resolver = createNodeDnsResolver({ dns: factory })
    const result = await resolver.resolveTxt(HOST)

    expect(result).toEqual({
      ok: true,
      records: ['domainproof-verify=fallback'],
    })
    expect(txtAttempts).toEqual([['203.0.113.1'], ['1.1.1.1', '8.8.8.8']])
  })

  it('bounds authoritative attempts to the discovered IPs, then falls back', async () => {
    const nameserverIps: Record<string, string[]> = {
      'ns1.example.com': ['203.0.113.1'],
      'ns2.example.com': ['203.0.113.2'],
      'ns3.example.com': ['203.0.113.3'],
    }

    const { factory, txtAttempts } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => [
          'ns1.example.com',
          'ns2.example.com',
          'ns3.example.com',
        ],
        resolve4: async (host) => nameserverIps[host] ?? [],
        resolveTxt: async () => [['domainproof-verify=fallback']],
      },
      '203.0.113.1': {
        resolveTxt: async () => {
          throw dnsError('ETIMEOUT')
        },
      },
      '203.0.113.2': {
        resolveTxt: async () => {
          throw dnsError('ETIMEOUT')
        },
      },
      '203.0.113.3': {
        resolveTxt: async () => {
          throw dnsError('ETIMEOUT')
        },
      },
    })

    const resolver = createNodeDnsResolver({ dns: factory })
    const result = await resolver.resolveTxt(HOST)

    expect(result).toEqual({
      ok: true,
      records: ['domainproof-verify=fallback'],
    })
    expect(txtAttempts).toEqual([
      ['203.0.113.1'],
      ['203.0.113.2'],
      ['203.0.113.3'],
      ['1.1.1.1', '8.8.8.8'],
    ])
  })

  it('times out via the Promise.race safety net rather than hanging when queries never settle', async () => {
    const { factory, txtAttempts } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => ['ns1.example.com'],
        resolve4: async () => ['203.0.113.1'],
        resolveTxt: () => new Promise<string[][]>(() => {}),
      },
      '203.0.113.1': {
        resolveTxt: () => new Promise<string[][]>(() => {}),
      },
    })

    const resolver = createNodeDnsResolver({ dns: factory, timeoutMs: 20 })
    const result = await resolver.resolveTxt(HOST)

    expect(result).toEqual({ ok: false, reason: 'timeout' })
    expect(txtAttempts).toEqual([['203.0.113.1'], ['1.1.1.1', '8.8.8.8']])
  })

  it('treats an empty TXT answer as no_records', async () => {
    const { factory } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => ['ns1.example.com'],
        resolve4: async () => ['203.0.113.1'],
      },
      '203.0.113.1': {
        resolveTxt: async () => [],
      },
    })

    const resolver = createNodeDnsResolver({ dns: factory })
    const result = await resolver.resolveTxt(HOST)

    expect(result).toEqual({ ok: false, reason: 'no_records' })
  })

  it('joins multi-chunk TXT records into whole values', async () => {
    const { factory } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => ['ns1.example.com'],
        resolve4: async () => ['203.0.113.1'],
      },
      '203.0.113.1': {
        resolveTxt: async () => [
          ['domainproof-verify=', 'abc123'],
          ['v=spf1 include:_spf.example.com ', '~all'],
        ],
      },
    })

    const resolver = createNodeDnsResolver({ dns: factory })
    const result = await resolver.resolveTxt(HOST)

    expect(result).toEqual({
      ok: true,
      records: [
        'domainproof-verify=abc123',
        'v=spf1 include:_spf.example.com ~all',
      ],
    })
  })

  const errorCodeMappings: Array<[string, TxtResolutionFailureReason]> = [
    ['ENOTFOUND', 'nxdomain'],
    ['ENODATA', 'no_records'],
    ['ETIMEOUT', 'timeout'],
    ['ESERVFAIL', 'server_failure'],
    ['EREFUSED', 'server_failure'],
    ['ECONNREFUSED', 'server_failure'],
  ]

  it.each(errorCodeMappings)(
    'maps a %s TXT query error to %s (via the fallback query)',
    async (code, reason) => {
      const { factory } = createFakeDns({
        '1.1.1.1': {
          resolveNs: async () => {
            // Force NS discovery to fail so the query goes straight to the
            // fallback path, isolating the TXT error-code mapping being
            // tested here from NS-discovery-failure behavior (covered
            // separately above).
            throw dnsError('ESERVFAIL')
          },
          resolveTxt: async () => {
            throw dnsError(code)
          },
        },
      })

      const resolver = createNodeDnsResolver({ dns: factory })
      const result = await resolver.resolveTxt(HOST)

      expect(result).toEqual({ ok: false, reason })
    },
  )
})

describe('discoverAuthoritativeNameservers', () => {
  it('returns nameservers and their first-resolved IPs on success', async () => {
    const { factory } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => ['ns1.example.com', 'ns2.example.com'],
        resolve4: async (host) =>
          host === 'ns1.example.com' ? ['203.0.113.1'] : ['203.0.113.2'],
      },
    })

    const result = await discoverAuthoritativeNameservers('example.com', {
      dns: factory,
    })

    expect(result).toEqual({
      ok: true,
      nameservers: ['ns1.example.com', 'ns2.example.com'],
      ips: ['203.0.113.1', '203.0.113.2'],
    })
  })

  it('reports no_records when the domain has no NS records', async () => {
    const { factory } = createFakeDns({
      '1.1.1.1': { resolveNs: async () => [] },
    })

    const result = await discoverAuthoritativeNameservers('example.com', {
      dns: factory,
    })

    expect(result).toEqual({ ok: false, reason: 'no_records' })
  })

  it('propagates the mapped failure reason when NS resolution itself fails', async () => {
    const { factory } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => {
          throw dnsError('ENOTFOUND')
        },
      },
    })

    const result = await discoverAuthoritativeNameservers('example.com', {
      dns: factory,
    })

    expect(result).toEqual({ ok: false, reason: 'nxdomain' })
  })

  it('reports server_failure when NS records resolve but none resolve to an IP', async () => {
    const { factory } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => ['ns1.example.com', 'ns2.example.com'],
        resolve4: async () => {
          throw dnsError('ENOTFOUND')
        },
      },
    })

    const result = await discoverAuthoritativeNameservers('example.com', {
      dns: factory,
    })

    expect(result).toEqual({ ok: false, reason: 'server_failure' })
  })

  it('skips a nameserver hostname that fails to resolve and keeps the ones that do', async () => {
    const { factory } = createFakeDns({
      '1.1.1.1': {
        resolveNs: async () => ['ns1.example.com', 'ns2.example.com'],
        resolve4: async (host) => {
          if (host === 'ns1.example.com') {
            throw dnsError('ENOTFOUND')
          }
          return ['203.0.113.2']
        },
      },
    })

    const result = await discoverAuthoritativeNameservers('example.com', {
      dns: factory,
    })

    expect(result).toEqual({
      ok: true,
      nameservers: ['ns1.example.com', 'ns2.example.com'],
      ips: ['203.0.113.2'],
    })
  })
})
