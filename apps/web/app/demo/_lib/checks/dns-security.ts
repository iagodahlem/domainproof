import type { CheckResult } from '../types'
import type { ProbeContext } from './context'

/**
 * Swapped in for the board's "Subdomain exposure" — see the feasibility
 * audit. Real subdomain discovery means crt.sh (rate-limited, third-party)
 * or a guessed wordlist (not a finding, a guess); CAA is a direct DNS
 * resolve with no such caveat. Absence isn't dangerous on its own — most
 * domains have none — so this only ever passes or warns, never fails.
 */
export function dnsSecurityCheck(ctx: ProbeContext): CheckResult {
  const base = {
    id: 'dns-security',
    title: 'DNS security posture',
    tier: 'full',
  } as const

  if (ctx.dns.caa.length === 0) {
    return {
      ...base,
      status: 'warn',
      summary:
        'No CAA record — any certificate authority can issue for this domain.',
    }
  }

  const issuers = ctx.dns.caa
    .map((record) => record.issue ?? record.issuewild)
    .filter((issuer): issuer is string => Boolean(issuer))

  return {
    ...base,
    status: 'pass',
    summary: issuers.length
      ? `CAA restricts issuance to: ${issuers.join(', ')}`
      : `${ctx.dns.caa.length} CAA record(s) present`,
  }
}
