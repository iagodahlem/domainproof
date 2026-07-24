import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getVisitorId } from '../../_lib/cookies'
import { getDemoDomainProofClient } from '../../_lib/sdk-client'
import { getClaim, resolveScanForClaim, saveClaim } from '../../_lib/store'
import { frontendTokenFromVerificationUrl } from '../../_lib/verification-url'

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

function statusFromSdkError(status: number): number {
  return status >= 400 && status < 600 ? status : 502
}

export async function GET(req: NextRequest) {
  const visitorId = getVisitorId(req)
  const claim = visitorId ? getClaim(visitorId) : null

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
  const scan = resolveScanForClaim(claim)

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
