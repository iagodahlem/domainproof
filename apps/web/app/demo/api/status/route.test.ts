// @vitest-environment node
import { NextRequest } from 'next/server'
import type { Domain, DomainProof, Result } from '@domainproof/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetRateLimitForTests } from '../../_lib/rate-limit'
import { getDemoDomainProofClient } from '../../_lib/sdk-client'
import { runScan } from '../../_lib/run-scan'
import {
  getClaim,
  getScanById,
  resetStoreForTests,
  saveClaim,
} from '../../_lib/store'
import type { ScanReport } from '../../_lib/types'
import { GET } from './route'

vi.mock('../../_lib/sdk-client', () => ({
  getDemoDomainProofClient: vi.fn(),
}))

vi.mock('../../_lib/run-scan', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/run-scan')>(
    '../../_lib/run-scan',
  )
  return { ...actual, runScan: vi.fn() }
})

const mockGetClient = vi.mocked(getDemoDomainProofClient)
const mockRunScan = vi.mocked(runScan)

function fakeDomain(overrides: Partial<Domain> = {}): Domain {
  return {
    id: 'dom_1',
    domain: 'acme.test',
    mode: 'test',
    status: 'verified',
    external_id: 'visitor_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    verifiedAt: '2026-01-01T00:00:00.000Z',
    verificationUrl: 'https://domainproof.dev/verify/tok_1',
    records: [],
    ...overrides,
  }
}

/**
 * This test double only implements the `domains` methods `status/route.ts`
 * actually calls (`get`, and `list` during claim recovery) — casting past
 * the full `DomainProof` surface is simpler than stubbing every other
 * method this route never touches.
 */
function fakeClient(overrides: {
  get?: () => Promise<Result<Domain>>
  list?: () => Promise<Result<{ domains: Domain[]; nextCursor: string | null }>>
}): DomainProof {
  return {
    domains: {
      get: overrides.get ?? (async () => ({ data: fakeDomain(), error: null })),
      list:
        overrides.list ??
        (async () => ({
          data: { domains: [], nextCursor: null },
          error: null,
        })),
    },
  } as unknown as DomainProof
}

function report(domain: string): ScanReport {
  return {
    domain,
    scannedAt: new Date(0).toISOString(),
    checks: [
      {
        id: 'https-tls',
        title: 'HTTPS/TLS',
        tier: 'full',
        status: 'pass',
        summary: 'ok',
      },
    ],
  }
}

function statusRequest(query: string, cookie?: string) {
  return new NextRequest(`http://localhost/demo/api/status${query}`, {
    headers: cookie ? { cookie } : undefined,
  })
}

beforeEach(() => {
  resetStoreForTests()
  resetRateLimitForTests()
  mockGetClient.mockReset()
  mockRunScan.mockReset()
  mockRunScan.mockResolvedValue({
    ok: false,
    reason: 'unreachable',
    reasons: [],
  })
})

describe('GET /demo/api/status', () => {
  it('reports unclaimed with no visitor cookie and no recovery hints', async () => {
    const res = await GET(statusRequest(''))
    expect(await res.json()).toEqual({ claimed: false, verified: false })
  })

  it('reports unclaimed when the store has no claim and no domain hint was sent', async () => {
    const res = await GET(statusRequest('', 'dp_demo_visitor=visitor_1'))
    expect(await res.json()).toEqual({ claimed: false, verified: false })
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  it('recovers a claim from the api when this instance never saw it, using the client-supplied domain as a lookup hint', async () => {
    const list = vi.fn(async () => ({
      data: { domains: [fakeDomain()], nextCursor: null },
      error: null,
    }))
    mockGetClient.mockReturnValue(fakeClient({ list }))

    const res = await GET(
      statusRequest(
        '?domain=acme.test&scanId=scan_1',
        'dp_demo_visitor=visitor_1',
      ),
    )
    const body = await res.json()

    expect(body.claimed).toBe(true)
    expect(body.verified).toBe(true)
    expect(body.frontendToken).toBe('tok_1')
    expect(body.hostedUrl).toBe('https://domainproof.dev/verify/tok_1')
    // The lookup is scoped to this visitor, never a bare domain search.
    expect(list).toHaveBeenCalledWith({
      domain: 'acme.test',
      externalId: 'visitor_1',
      limit: 1,
    })
    // The recovered claim is saved back, so the next poll on this instance
    // no longer needs to recover it again.
    expect(getClaim('visitor_1')).toMatchObject({
      domain: 'acme.test',
      domainId: 'dom_1',
      scanId: 'scan_1',
    })
  })

  it('stays unclaimed when the recovery lookup matches nothing for this visitor', async () => {
    mockGetClient.mockReturnValue(
      fakeClient({
        list: async () => ({
          data: { domains: [], nextCursor: null },
          error: null,
        }),
      }),
    )

    const res = await GET(
      statusRequest(
        '?domain=someone-elses.test&scanId=scan_1',
        'dp_demo_visitor=visitor_1',
      ),
    )
    expect(await res.json()).toEqual({ claimed: false, verified: false })
  })

  it('re-runs the scan when a verified claim unlocked one but this instance lost it', async () => {
    saveClaim('visitor_1', {
      domain: 'acme.test',
      domainId: 'dom_1',
      verificationUrl: 'https://domainproof.dev/verify/tok_1',
      frontendToken: 'tok_1',
      scanId: 'scan_1',
    })
    mockGetClient.mockReturnValue(fakeClient({}))
    mockRunScan.mockResolvedValue({ ok: true, report: report('acme.test') })

    const res = await GET(
      statusRequest(
        '?domain=acme.test&scanId=scan_1',
        'dp_demo_visitor=visitor_1',
      ),
    )
    const body = await res.json()

    expect(mockRunScan).toHaveBeenCalledWith('acme.test')
    expect(body.verified).toBe(true)
    expect(body.fullReport).toEqual(report('acme.test').checks)
    // Saved under the claim's own scanId, so a concurrent scan-restore
    // fetch (or the next status poll) resolves the same report.
    expect(getScanById('scan_1')?.domain).toBe('acme.test')
  })

  it('never re-runs a scan for a claim that was never scanned in the first place', async () => {
    saveClaim('visitor_1', {
      domain: 'acme.test',
      domainId: 'dom_1',
      verificationUrl: 'https://domainproof.dev/verify/tok_1',
      frontendToken: 'tok_1',
      // No scanId — a bare `{ domain }` claim (see claim/route.ts).
    })
    mockGetClient.mockReturnValue(fakeClient({}))

    const res = await GET(statusRequest('', 'dp_demo_visitor=visitor_1'))
    const body = await res.json()

    expect(mockRunScan).not.toHaveBeenCalled()
    expect(body.verified).toBe(true)
    expect(body.fullReport).toBeNull()
  })

  it('skips the scan recovery quietly when its rate budget is spent, leaving fullReport null for this tick', async () => {
    saveClaim('visitor_1', {
      domain: 'acme.test',
      domainId: 'dom_1',
      verificationUrl: 'https://domainproof.dev/verify/tok_1',
      frontendToken: 'tok_1',
      scanId: 'scan_1',
    })
    mockGetClient.mockReturnValue(fakeClient({}))

    const { checkRateLimit } = await import('../../_lib/rate-limit')
    const { SCAN_RATE_LIMIT } = await import('../../_lib/run-scan')
    for (let i = 0; i < SCAN_RATE_LIMIT.limit; i += 1) {
      checkRateLimit('scan:unknown', SCAN_RATE_LIMIT)
    }

    const res = await GET(statusRequest('', 'dp_demo_visitor=visitor_1'))
    const body = await res.json()

    expect(mockRunScan).not.toHaveBeenCalled()
    expect(body.verified).toBe(true)
    expect(body.fullReport).toBeNull()
  })
})
