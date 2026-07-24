import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ensureVisitorId, setVisitorCookie } from '../../_lib/cookies'
import { validateHostname } from '../../_lib/hostname'
import { checkRateLimit } from '../../_lib/rate-limit'
import { clientIpFromHeaders } from '../../_lib/request-ip'
import { getDemoDomainProofClient } from '../../_lib/sdk-client'
import { getScanById, saveClaim } from '../../_lib/store'

const CLAIM_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }

interface ClaimRequestBody {
  scanId?: unknown
  domain?: unknown
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

function statusFromSdkError(status: number): number {
  return status >= 400 && status < 600 ? status : 502
}

/**
 * A claim's `frontendToken` is the last path segment of its
 * `verificationUrl` — the public v1 API only ever exposes the URL, never
 * the raw token (see `apps/api/src/shared/verification-url.ts`'s
 * `buildVerificationUrl`), so this is the intended way to recover it.
 * `null` only if the URL is ever shaped unexpectedly.
 */
function frontendTokenFromVerificationUrl(
  verificationUrl: string,
): string | null {
  try {
    const segments = new URL(verificationUrl).pathname
      .split('/')
      .filter(Boolean)
    return segments.at(-1) ?? null
  } catch {
    return null
  }
}

/**
 * Accepts either `{ scanId }` (the normal flow — reuses the exact domain a
 * prior `POST /demo/api/scan` reported on) or `{ domain }` directly. The
 * two are decoupled on purpose: DomainProof's own `.test` sandbox never
 * touches real DNS, but this route's own scan checks do, so a `.test`
 * domain can never produce a scan report — decoupling is what makes it
 * possible to exercise claim/status against the ownership-verification
 * sandbox without waiting on real DNS for a TLD that will never resolve.
 */
export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers)
  const rateLimit = checkRateLimit(`claim:${ip}`, CLAIM_RATE_LIMIT)
  if (!rateLimit.allowed) {
    return errorResponse(
      429,
      'rate_limited',
      'Too many claim attempts from this address — try again later.',
    )
  }

  const body = (await req.json().catch(() => null)) as ClaimRequestBody | null
  const scanId = typeof body?.scanId === 'string' ? body.scanId : null
  const rawDomain = typeof body?.domain === 'string' ? body.domain : null

  let domain: string
  if (scanId) {
    const scan = getScanById(scanId)
    if (!scan) {
      return errorResponse(
        404,
        'not_found',
        'Unknown or expired scanId — scan the domain again.',
      )
    }
    domain = scan.domain
  } else if (rawDomain) {
    const validation = validateHostname(rawDomain)
    if (!validation.ok) {
      return errorResponse(
        400,
        'invalid_domain',
        'Domain is not a valid hostname.',
      )
    }
    domain = validation.domain
  } else {
    return errorResponse(
      400,
      'invalid_request',
      'Body must include either { scanId } or { domain }.',
    )
  }

  const { visitorId } = ensureVisitorId(req)
  const client = getDemoDomainProofClient()

  const [claimResult, sessionResult] = await Promise.all([
    client.domains.claim({ domain, externalId: visitorId }),
    client.componentSessions.create({ externalId: visitorId }),
  ])

  let domainData
  if (claimResult.error) {
    if (claimResult.error.code !== 'domain_already_claimed') {
      return errorResponse(
        statusFromSdkError(claimResult.error.status),
        claimResult.error.code,
        claimResult.error.message,
      )
    }

    // This single-project demo re-claims the exact domain it already holds
    // a claim on every time a visitor re-enters it (a fresh visitor cookie,
    // or the same one after a refresh) — the (project, domain, mode)
    // uniqueness `conflict()` (apis/v1/routes/domains.ts) protects against
    // is a real integrator's *different* projects, not this. Look the claim
    // up instead of failing: it's the same claim every other visitor of
    // this domain already sees.
    const existing = await client.domains.list({ domain, limit: 1 })
    const found = existing.data?.domains[0]
    if (!found) {
      return errorResponse(
        statusFromSdkError(claimResult.error.status),
        claimResult.error.code,
        claimResult.error.message,
      )
    }
    domainData = found
  } else {
    domainData = claimResult.data
  }

  const frontendToken = frontendTokenFromVerificationUrl(
    domainData.verificationUrl,
  )

  saveClaim(visitorId, {
    domain,
    domainId: domainData.id,
    verificationUrl: domainData.verificationUrl,
    scanId: scanId ?? undefined,
    frontendToken,
  })

  const res = NextResponse.json({
    domainId: domainData.id,
    domain,
    records: domainData.records,
    hostedUrl: domainData.verificationUrl,
    // The claim already made above — lets the embedded widget render
    // already bound to it (see verify-gate.tsx) instead of asking the
    // visitor to claim the same domain a second time.
    frontendToken,
    // A failed component-session mint doesn't invalidate the claim itself —
    // the hosted link above is a complete fallback on its own — so this
    // stays a soft null rather than failing the whole request. Still minted
    // unconditionally: it's the escape hatch for verifying a *different*
    // domain than the one already claimed above.
    sessionToken: sessionResult.error ? null : sessionResult.data.sessionToken,
    sessionExpiresAt: sessionResult.error ? null : sessionResult.data.expiresAt,
  })
  setVisitorCookie(res, visitorId)
  return res
}
