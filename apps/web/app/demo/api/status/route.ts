import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getVisitorId } from '../../_lib/cookies'
import { getDemoDomainProofClient } from '../../_lib/sdk-client'
import { getClaim, resolveScanForClaim } from '../../_lib/store'

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

function statusFromSdkError(status: number): number {
  return status >= 400 && status < 600 ? status : 502
}

export async function GET(req: NextRequest) {
  const visitorId = getVisitorId(req)
  const claim = visitorId ? getClaim(visitorId) : null

  if (!claim) {
    return NextResponse.json({ claimed: false, verified: false })
  }

  const client = getDemoDomainProofClient()
  const result = await client.domains.get(claim.domainId)
  if (result.error) {
    return errorResponse(
      statusFromSdkError(result.error.status),
      result.error.code,
      result.error.message,
    )
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
  })
}
