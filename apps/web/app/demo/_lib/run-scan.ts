import { promises as dnsPromises } from 'node:dns'
import { cookieSecurityCheck } from './checks/cookie-security'
import type { ProbeContext } from './checks/context'
import { dnsRecordsCheck } from './checks/dns-records'
import { dnsSecurityCheck } from './checks/dns-security'
import { emailPostureCheck } from './checks/email-posture'
import { headerBreakdownCheck } from './checks/header-breakdown'
import { httpsTlsCheck } from './checks/https-tls'
import { responseTimeCheck } from './checks/response-time'
import { securityHeadersCheck } from './checks/security-headers'
import { techFingerprintCheck } from './checks/tech-fingerprint'
import { runDkimProbe } from './probes/dkim-probe'
import type { DnsResolverLike } from './probes/dns-probe'
import { runDnsProbe } from './probes/dns-probe'
import type { FetchProbeOptions } from './probes/fetch-probe'
import { runFetchProbe } from './probes/fetch-probe'
import type { TlsProbeOptions } from './probes/tls-probe'
import { runTlsProbe } from './probes/tls-probe'
import { withTimeout } from './timeout'
import type { CheckResult, ScanOutcome } from './types'

const LOOKUP_TIMEOUT_MS = 8_000

/**
 * Shared by every caller that can trigger a scan — `POST /demo/api/scan`
 * and the stateless-recovery re-scans in `GET /demo/api/scan` and
 * `GET /demo/api/status` (see their own doc comments) — since they're all
 * the same expensive network probe, just reached from different routes.
 */
export const SCAN_RATE_LIMIT = { limit: 10, windowMs: 5 * 60 * 1000 }

const NO_DNS_REASONS = [
  'No A or AAAA record found for this host',
  'The domain may not exist, or DNS has not propagated yet',
]

const NO_RESPONSE_REASONS = [
  'DNS resolved, but nothing answered on port 443 in time',
  'The server may be down, or a firewall is blocking the connection',
]

export interface RunScanDeps {
  lookup?: (hostname: string) => Promise<unknown>
  lookupTimeoutMs?: number
  fetchOptions?: FetchProbeOptions
  tlsOptions?: TlsProbeOptions
  dnsResolver?: DnsResolverLike
}

/**
 * Two distinct "we couldn't reach this domain" cases, kept separate for the
 * caller's benefit even though both currently render the same edge-case
 * shape: no DNS at all (the domain doesn't exist / hasn't propagated) vs.
 * DNS resolves but nothing answers on 443 (the host is down or firewalled).
 * A short-circuit on the first case avoids spending the TLS/fetch timeouts
 * on a hostname that can never answer.
 */
export async function runScan(
  domain: string,
  deps: RunScanDeps = {},
): Promise<ScanOutcome> {
  const lookup =
    deps.lookup ?? ((hostname: string) => dnsPromises.lookup(hostname))

  try {
    await withTimeout(lookup(domain), deps.lookupTimeoutMs ?? LOOKUP_TIMEOUT_MS)
  } catch {
    return { ok: false, reason: 'unreachable', reasons: NO_DNS_REASONS }
  }

  const [fetchResult, tlsResult, dnsResult, dkimResult] = await Promise.all([
    runFetchProbe(domain, deps.fetchOptions),
    runTlsProbe(domain, deps.tlsOptions),
    runDnsProbe(domain, deps.dnsResolver),
    runDkimProbe(domain, deps.dnsResolver),
  ])

  if (!fetchResult.ok && !tlsResult.ok) {
    return { ok: false, reason: 'unreachable', reasons: NO_RESPONSE_REASONS }
  }

  const ctx: ProbeContext = {
    fetch: fetchResult,
    tls: tlsResult,
    dns: dnsResult,
    dkim: dkimResult,
  }

  const checks: CheckResult[] = [
    httpsTlsCheck(ctx),
    securityHeadersCheck(ctx),
    dnsRecordsCheck(ctx),
    responseTimeCheck(ctx),
    headerBreakdownCheck(ctx),
    techFingerprintCheck(ctx),
    emailPostureCheck(ctx),
    cookieSecurityCheck(ctx),
    dnsSecurityCheck(ctx),
  ]

  return {
    ok: true,
    report: { domain, scannedAt: new Date().toISOString(), checks },
  }
}
