import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getClaim,
  getLatestScanForDomain,
  getScanById,
  resetStoreForTests,
  resolveScanForClaim,
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
      frontendToken: 'abc',
    })
    expect(getClaim('visitor_1')).toMatchObject({
      domain: 'example.com',
      domainId: 'dom_1',
    })
  })

  it('retains the scanId a claim was made with', () => {
    saveClaim('visitor_1', {
      domain: 'example.com',
      domainId: 'dom_1',
      verificationUrl: 'https://domainproof.dev/verify/abc',
      frontendToken: 'abc',
      scanId: 'scan_1',
    })
    expect(getClaim('visitor_1')?.scanId).toBe('scan_1')
  })

  it('overwrites a visitor’s previous claim with a new one', () => {
    saveClaim('visitor_1', {
      domain: 'first.com',
      domainId: 'dom_1',
      verificationUrl: 'https://domainproof.dev/verify/1',
      frontendToken: '1',
    })
    saveClaim('visitor_1', {
      domain: 'second.com',
      domainId: 'dom_2',
      verificationUrl: 'https://domainproof.dev/verify/2',
      frontendToken: '2',
    })
    expect(getClaim('visitor_1')?.domain).toBe('second.com')
  })

  it('returns null for a visitor with no claim', () => {
    expect(getClaim('nobody')).toBeNull()
  })
})

describe('resolveScanForClaim', () => {
  it('resolves the exact scan the claim pinned, not whatever is latest for the domain', () => {
    saveScan('scan_1', 'example.com', report('example.com'))
    // A different visitor rescans the same domain after the claim was made.
    saveScan('scan_2', 'example.com', report('example.com'))

    expect(
      resolveScanForClaim({ scanId: 'scan_1', domain: 'example.com' })?.scanId,
    ).toBe('scan_1')
  })

  it('falls back to the latest scan for the domain once the pinned scan has expired', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    saveScan('scan_1', 'example.com', report('example.com'))
    vi.setSystemTime(3 * 60 * 60 * 1000)
    saveScan('scan_2', 'example.com', report('example.com'))

    expect(
      resolveScanForClaim({ scanId: 'scan_1', domain: 'example.com' })?.scanId,
    ).toBe('scan_2')
  })

  it('falls back to the latest scan for the domain when the claim has no pinned scanId', () => {
    saveScan('scan_1', 'example.com', report('example.com'))

    expect(
      resolveScanForClaim({ scanId: undefined, domain: 'example.com' })?.scanId,
    ).toBe('scan_1')
  })

  it('returns null when neither the pinned nor the latest scan exists', () => {
    expect(
      resolveScanForClaim({ scanId: undefined, domain: 'unscanned.com' }),
    ).toBeNull()
  })
})
