import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ensureVisitorId, setVisitorCookie } from '../../_lib/cookies'
import { computeGrade } from '../../_lib/grade'
import type { HostnameValidationFailureReason } from '../../_lib/hostname'
import { validateHostname } from '../../_lib/hostname'
import { checkRateLimit } from '../../_lib/rate-limit'
import { clientIpFromHeaders } from '../../_lib/request-ip'
import { runScan, SCAN_RATE_LIMIT } from '../../_lib/run-scan'
import { getScanById, saveScan } from '../../_lib/store'
import type { ScanReport } from '../../_lib/types'

const HOSTNAME_ERROR_MESSAGES: Record<HostnameValidationFailureReason, string> =
  {
    empty: 'Domain is required.',
    too_long: 'Domain is too long to be a valid hostname.',
    is_ip: 'Domain must be a hostname, not an IP address.',
    invalid_format: 'Domain is not a valid hostname.',
  }

interface ScanRequestBody {
  domain?: unknown
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status })
}

/** The client-facing shape of a scan — shared by a fresh `POST` and a `GET` restore. */
function scanSummary(scan: {
  scanId: string
  domain: string
  report: ScanReport
}) {
  const teaser = scan.report.checks.filter((check) => check.tier === 'teaser')
  const { grade, label } = computeGrade(teaser)
  return {
    scanId: scan.scanId,
    domain: scan.domain,
    grade,
    gradeLabel: label,
    teaser,
  }
}

/**
 * Restores a scan already reported on — the report view is client state
 * only, so a page refresh needs a way to re-fetch it by the `scanId` the
 * page pins to its own URL (see `sitegrade-app.tsx`). Also the target of
 * the same statelessness problem `status/route.ts` documents: this
 * instance's `scansById` may never have held `scanId` at all (TTL, or a
 * different serverless instance handled the original scan). When the page
 * also pinned `domain` to the URL, that's a durable-enough hint to
 * re-run the scan and re-serve it under the same `scanId` rather than
 * 404ing — same rate budget as a fresh `POST`, since it's the same probe.
 * Still 404s when there's no `domain` hint to recover from, or the rescan
 * itself fails; the page falls back to the empty form rather than
 * surfacing an error for what's just an expired demo scan.
 */
export async function GET(req: NextRequest) {
  const scanId = req.nextUrl.searchParams.get('scanId')
  if (!scanId) {
    return errorResponse(
      400,
      'invalid_request',
      'scanId query param is required.',
    )
  }

  let scan = getScanById(scanId)
  if (!scan) {
    const domainHint = req.nextUrl.searchParams.get('domain')
    const validation = domainHint ? validateHostname(domainHint) : null
    const ip = clientIpFromHeaders(req.headers)
    if (
      validation?.ok &&
      checkRateLimit(`scan:${ip}`, SCAN_RATE_LIMIT).allowed
    ) {
      const outcome = await runScan(validation.domain)
      if (outcome.ok) {
        saveScan(scanId, validation.domain, outcome.report)
        scan = getScanById(scanId)
      }
    }
  }

  if (!scan) {
    return errorResponse(
      404,
      'not_found',
      'Unknown or expired scanId — scan the domain again.',
    )
  }

  return NextResponse.json(scanSummary(scan))
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers)
  const rateLimit = checkRateLimit(`scan:${ip}`, SCAN_RATE_LIMIT)
  if (!rateLimit.allowed) {
    return errorResponse(
      429,
      'rate_limited',
      'Too many scans from this address — try again in a few minutes.',
      { retryAfterMs: rateLimit.retryAfterMs },
    )
  }

  const body = (await req.json().catch(() => null)) as ScanRequestBody | null
  if (!body || typeof body.domain !== 'string') {
    return errorResponse(
      400,
      'invalid_request',
      'Body must be { domain: string }.',
    )
  }

  const validation = validateHostname(body.domain)
  if (!validation.ok) {
    return errorResponse(
      400,
      'invalid_domain',
      HOSTNAME_ERROR_MESSAGES[validation.reason],
    )
  }

  const outcome = await runScan(validation.domain)
  if (!outcome.ok) {
    return errorResponse(
      422,
      'domain_unreachable',
      `We couldn't reach ${validation.domain}.`,
      { reasons: outcome.reasons },
    )
  }

  const scanId = randomUUID()
  saveScan(scanId, validation.domain, outcome.report)

  const res = NextResponse.json(
    scanSummary({ scanId, domain: validation.domain, report: outcome.report }),
  )

  const { visitorId } = ensureVisitorId(req)
  setVisitorCookie(res, visitorId)
  return res
}
