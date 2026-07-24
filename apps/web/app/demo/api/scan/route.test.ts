// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetRateLimitForTests } from '../../_lib/rate-limit'
import { runScan } from '../../_lib/run-scan'
import { getScanById, resetStoreForTests, saveScan } from '../../_lib/store'
import type { ScanReport } from '../../_lib/types'
import { GET } from './route'

vi.mock('../../_lib/run-scan', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/run-scan')>(
    '../../_lib/run-scan',
  )
  return { ...actual, runScan: vi.fn() }
})

const mockRunScan = vi.mocked(runScan)

function report(domain: string): ScanReport {
  return {
    domain,
    scannedAt: new Date(0).toISOString(),
    checks: [
      {
        id: 'https-tls',
        title: 'HTTPS/TLS',
        tier: 'teaser',
        status: 'pass',
        summary: 'ok',
      },
    ],
  }
}

function scanRequest(query: string) {
  return new NextRequest(`http://localhost/demo/api/scan${query}`)
}

beforeEach(() => {
  resetStoreForTests()
  resetRateLimitForTests()
  mockRunScan.mockReset()
})

describe('GET /demo/api/scan (restore)', () => {
  it('restores a scan already held in the store, without touching runScan', async () => {
    saveScan('scan_1', 'acme.test', report('acme.test'))

    const res = await GET(scanRequest('?scanId=scan_1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.domain).toBe('acme.test')
    expect(mockRunScan).not.toHaveBeenCalled()
  })

  it('re-runs the scan when this instance lost it, given a domain hint, and saves it back under the same scanId', async () => {
    mockRunScan.mockResolvedValue({ ok: true, report: report('acme.test') })

    const res = await GET(scanRequest('?scanId=scan_1&domain=acme.test'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.domain).toBe('acme.test')
    expect(mockRunScan).toHaveBeenCalledWith('acme.test')
    expect(getScanById('scan_1')?.domain).toBe('acme.test')
  })

  it('404s when the scan is missing and there is no domain hint to recover from', async () => {
    const res = await GET(scanRequest('?scanId=scan_1'))
    expect(res.status).toBe(404)
    expect(mockRunScan).not.toHaveBeenCalled()
  })

  it('404s when the recovery rescan itself fails (domain unreachable again)', async () => {
    mockRunScan.mockResolvedValue({
      ok: false,
      reason: 'unreachable',
      reasons: ['no DNS'],
    })

    const res = await GET(scanRequest('?scanId=scan_1&domain=acme.test'))
    expect(res.status).toBe(404)
  })

  it('404s without ever calling runScan when the domain hint is not a valid hostname', async () => {
    const res = await GET(scanRequest('?scanId=scan_1&domain=not a domain'))
    expect(res.status).toBe(404)
    expect(mockRunScan).not.toHaveBeenCalled()
  })

  it('shares the scan rate budget with POST — a spent budget 404s instead of rescanning', async () => {
    const { checkRateLimit } = await import('../../_lib/rate-limit')
    const { SCAN_RATE_LIMIT } = await import('../../_lib/run-scan')
    for (let i = 0; i < SCAN_RATE_LIMIT.limit; i += 1) {
      checkRateLimit('scan:unknown', SCAN_RATE_LIMIT)
    }

    const res = await GET(scanRequest('?scanId=scan_1&domain=acme.test'))
    expect(res.status).toBe(404)
    expect(mockRunScan).not.toHaveBeenCalled()
  })
})
