import type { ScanReport } from './types'

export interface StoredScan {
  scanId: string
  domain: string
  report: ScanReport
  createdAt: number
}

export interface StoredClaim {
  visitorId: string
  domain: string
  domainId: string
  verificationUrl: string
  createdAt: number
}

// Single-process, in-memory storage — fine for a public demo (same
// reasoning as the rate limiter): nothing here needs to survive a restart
// or be shared across instances, and it keeps this route consuming only
// @domainproof/sdk, never a database of its own.
const SCAN_TTL_MS = 2 * 60 * 60 * 1000
const CLAIM_TTL_MS = 24 * 60 * 60 * 1000

const scansById = new Map<string, StoredScan>()
const scansByDomain = new Map<string, StoredScan>()
const claimsByVisitor = new Map<string, StoredClaim>()

function pruneExpired<K>(
  map: Map<K, { createdAt: number }>,
  ttlMs: number,
): void {
  const now = Date.now()
  for (const [key, value] of map) {
    if (now - value.createdAt > ttlMs) {
      map.delete(key)
    }
  }
}

export function saveScan(
  scanId: string,
  domain: string,
  report: ScanReport,
): void {
  pruneExpired(scansById, SCAN_TTL_MS)
  pruneExpired(scansByDomain, SCAN_TTL_MS)
  const entry: StoredScan = { scanId, domain, report, createdAt: Date.now() }
  scansById.set(scanId, entry)
  scansByDomain.set(domain, entry)
}

export function getScanById(scanId: string): StoredScan | null {
  return scansById.get(scanId) ?? null
}

export function getLatestScanForDomain(domain: string): StoredScan | null {
  return scansByDomain.get(domain) ?? null
}

export function saveClaim(
  visitorId: string,
  claim: Omit<StoredClaim, 'visitorId' | 'createdAt'>,
): void {
  pruneExpired(claimsByVisitor, CLAIM_TTL_MS)
  claimsByVisitor.set(visitorId, {
    visitorId,
    createdAt: Date.now(),
    ...claim,
  })
}

export function getClaim(visitorId: string): StoredClaim | null {
  return claimsByVisitor.get(visitorId) ?? null
}

/** Test-only: clears every in-memory store between test cases. */
export function resetStoreForTests(): void {
  scansById.clear()
  scansByDomain.clear()
  claimsByVisitor.clear()
}
