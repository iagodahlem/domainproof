import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getClaim,
  getLatestScanForDomain,
  getScanById,
  resetStoreForTests,
  saveClaim,
  saveScan,
} from './store'
import type { ScanReport } from './types'

function report(domain: string): ScanReport {
  return { domain, scannedAt: new Date(0).toISOString(), checks: [] }
}

beforeEach(() => {
  resetStoreForTests()
  vi.useRealTimers()
})

describe('scan store', () => {
  it('retrieves a saved scan by id and by domain', () => {
    saveScan('scan_1', 'example.com', report('example.com'))
    expect(getScanById('scan_1')?.domain).toBe('example.com')
    expect(getLatestScanForDomain('example.com')?.scanId).toBe('scan_1')
  })

  it('returns null for an unknown scan id', () => {
    expect(getScanById('missing')).toBeNull()
  })

  it('keeps only the latest scan per domain', () => {
    saveScan('scan_1', 'example.com', report('example.com'))
    saveScan('scan_2', 'example.com', report('example.com'))
    expect(getLatestScanForDomain('example.com')?.scanId).toBe('scan_2')
  })

  it('expires scans older than the TTL', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    saveScan('scan_1', 'example.com', report('example.com'))
    vi.setSystemTime(3 * 60 * 60 * 1000)
    // A save of an unrelated scan is what triggers pruning.
    saveScan('scan_2', 'other.com', report('other.com'))
    expect(getScanById('scan_1')).toBeNull()
  })
})

describe('claim store', () => {
  it('retrieves a saved claim by visitor id', () => {
    saveClaim('visitor_1', {
      domain: 'example.com',
      domainId: 'dom_1',
      verificationUrl: 'https://domainproof.dev/verify/abc',
    })
    expect(getClaim('visitor_1')).toMatchObject({
      domain: 'example.com',
      domainId: 'dom_1',
    })
  })

  it('overwrites a visitor’s previous claim with a new one', () => {
    saveClaim('visitor_1', {
      domain: 'first.com',
      domainId: 'dom_1',
      verificationUrl: 'https://domainproof.dev/verify/1',
    })
    saveClaim('visitor_1', {
      domain: 'second.com',
      domainId: 'dom_2',
      verificationUrl: 'https://domainproof.dev/verify/2',
    })
    expect(getClaim('visitor_1')?.domain).toBe('second.com')
  })

  it('returns null for a visitor with no claim', () => {
    expect(getClaim('nobody')).toBeNull()
  })
})
