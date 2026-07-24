import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getVisitorId } from '../../_lib/cookies'
import { validateHostname } from '../../_lib/hostname'
import { checkRateLimit } from '../../_lib/rate-limit'
import { clientIpFromHeaders } from '../../_lib/request-ip'
import { runScan, SCAN_RATE_LIMIT } from '../../_lib/run-scan'
import { getDemoDomainProofClient } from '../../_lib/sdk-client'
import {
  getClaim,
  getScanById,
  resolveScanForClaim,
  saveClaim,
  saveScan,
  type StoredClaim,
} from '../../_lib/store'
import { frontendTokenFromVerificationUrl } from '../../_lib/verification-url'

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

function statusFromSdkError(status: number): number {
  return status >= 400 && status < 600 ? status : 502
}

/**
 * Recovers a visitor's claim when this instance's `claimsByVisitor` never
 * saw it — a different serverless instance handled the original claim (see
 * `store.ts`'s own doc comment on why the store is instance-local at all).
 * `domainHint` is client-supplied and used only as a lookup key; what
 * actually authorizes the result is the API's own `externalId` filter,
 * scoped server-side to this visitor's httpOnly cookie — a hint for a
 * domain this visitor never claimed simply matches nothing.
 */
async function recoverClaim(
  visitorId: string,
  domainHint: string,
  scanIdHint: string | null,
): Promise<StoredClaim | null> {
  const validation = validateHostname(domainHint)
  if (!validation.ok) return null

  const client = getDemoDomainProofClient()
  const found = await client.domains.list({
    domain: validation.domain,
    externalId: visitorId,
    limit: 1,
  })
  const domainData = found.data?.domains[0]
  if (!domainData) return null

  const frontendToken = frontendTokenFromVerificationUrl(
    domainData.verificationUrl,
  )
  saveClaim(visitorId, {
    domain: validation.domain,
    domainId: domainData.id,
    verificationUrl: domainData.verificationUrl,
    scanId: scanIdHint ?? undefined,
    frontendToken,
  })
  return getClaim(visitorId)
}

/**
 * Re-runs the exact scan a verified claim unlocked when this instance's
 * `scansById` lost it (TTL, restart, or another instance's memory) —
 * same probes `POST /demo/api/scan` runs, saved back under the claim's own
 * `scanId` so `resolveScanForClaim` and a concurrent `GET /demo/api/scan`
 * restore agree on the same report. Shares that route's rate budget, since
 * it's the same expensive network work; skips quietly, leaving `fullReport`
 * null for this tick, rather than failing the whole status response when
 * the budget's spent — the next poll tries again.
 */
async function recoverScan(domain: string, scanId: string, ip: string) {
  if (!checkRateLimit(`scan:${ip}`, SCAN_RATE_LIMIT).allowed) return null
  const outcome = await runScan(domain)
  if (!outcome.ok) return null
  saveScan(scanId, domain, outcome.report)
  return getScanById(scanId)
}

export async function GET(req: NextRequest) {
  const visitorId = getVisitorId(req)
  let claim = visitorId ? getClaim(visitorId) : null

  const domainHint = req.nextUrl.searchParams.get('domain')
  if (!claim && visitorId && domainHint) {
    claim = await recoverClaim(
      visitorId,
      domainHint,
      req.nextUrl.searchParams.get('scanId'),
    )
  }

  if (!visitorId || !claim) {
    return NextResponse.json({ claimed: false, verified: false })
  }

  const client = getDemoDomainProofClient()
  const result = await client.domains.get(claim.domainId)
  if (result.error) {
    if (result.error.code !== 'not_found') {
      return errorResponse(
        statusFromSdkError(result.error.status),
        result.error.code,
        result.error.message,
      )
    }

    // The claimed domain no longer resolves — most likely its owner
    // deleted it via the dashboard since this visitor claimed it. Reusing
    // the dead claim as-is would leave the embedded widget bound to a
    // frontendToken that 404s forever (see verify-gate.tsx), so reclaim the
    // same domain fresh and replace the stored claim rather than just
    // erroring. The reclaimed frontendToken is returned below the same way
    // the healthy branch always does (not just here) — a concurrent poll
    // (this visitor's own background one, or another request racing this
    // one) could equally be the one that lands after the store's already
    // updated, and it needs the current token too in order to rebind the
    // widget instead of running the reclaim a second time.
    const reclaimed = await client.domains.claim({
      domain: claim.domain,
      externalId: visitorId,
    })
    if (reclaimed.error) {
      return errorResponse(
        statusFromSdkError(reclaimed.error.status),
        reclaimed.error.code,
        reclaimed.error.message,
      )
    }

    const frontendToken = frontendTokenFromVerificationUrl(
      reclaimed.data.verificationUrl,
    )
    saveClaim(visitorId, {
      domain: claim.domain,
      domainId: reclaimed.data.id,
      verificationUrl: reclaimed.data.verificationUrl,
      scanId: claim.scanId,
      frontendToken,
    })

    return NextResponse.json({
      claimed: true,
      verified: false,
      domain: claim.domain,
      status: reclaimed.data.status,
      verifiedAt: null,
      fullReport: null,
      frontendToken,
      hostedUrl: reclaimed.data.verificationUrl,
    })
  }

  const verified = result.data.status === 'verified'
  let scan = resolveScanForClaim(claim)
  // The claim did unlock a real scan (`claim.scanId` set), but this
  // instance's `scansById` lost it — recover it rather than reporting
  // `fullReport: null` for a claim that has every right to one.
  if (verified && !scan && claim.scanId) {
    scan = await recoverScan(
      claim.domain,
      claim.scanId,
      clientIpFromHeaders(req.headers),
    )
  }

  return NextResponse.json({
    claimed: true,
    verified,
    domain: claim.domain,
    status: result.data.status,
    verifiedAt: result.data.verifiedAt,
    // Only present once verified, and only if this exact domain was ever
    // scanned by this visitor — claim/status work even without a prior
    // scan (see claim/route.ts), so there's honestly nothing to unlock yet
    // in that case.
    fullReport: verified ? (scan?.report.checks ?? null) : null,
    // Always the store's current values, not just on a reclaim above — the
    // client re-syncs `claim.frontendToken` from every poll response (see
    // sitegrade-app.tsx's `refreshStatus`), which is what makes a reclaim
    // from a *different* poll (this visitor's own earlier one, or another
    // request racing it) still reach the widget instead of going stale.
    frontendToken: claim.frontendToken,
    hostedUrl: claim.verificationUrl,
  })
}
