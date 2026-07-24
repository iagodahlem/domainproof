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
  /** Parsed from `verificationUrl`'s own last path segment — see `claim/route.ts`. `null` only if that URL is ever shaped unexpectedly. */
  frontendToken: string | null
  createdAt: number
  /** The scan this visitor unlocked by claiming, if the claim came from a prior `POST /demo/api/scan` (see claim/route.ts) rather than a bare `{ domain }`. Pins `fullReport` to the scan this visitor actually saw, so a later rescan of the same domain by someone else can't swap out what they unlock. */
  scanId?: string
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

/**
 * The scan a claim's `fullReport` should come from: the exact scan the
 * visitor unlocked, not whatever the domain's most recent scan happens to
 * be now (someone else could have rescanned the same domain since). Only
 * falls back to the latest-for-domain scan once the exact one has aged out
 * of `scansById`'s TTL — at that point there's nothing exact left to show,
 * and the latest scan is a better answer than no report at all.
 */
export function resolveScanForClaim(
  claim: Pick<StoredClaim, 'scanId' | 'domain'>,
): StoredScan | null {
  if (claim.scanId) {
    const exact = getScanById(claim.scanId)
    if (exact) return exact
  }
  return getLatestScanForDomain(claim.domain)
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
