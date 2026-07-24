import type { CheckResult } from '../types'
import type { ProbeContext } from './context'
import {
  evaluateSecurityHeaders,
  SECURITY_HEADERS,
} from './security-headers-shared'

/** Full-tier companion to security-headers.ts — same probe, same evaluation, but names exactly which headers are missing instead of just a count. */
export function headerBreakdownCheck(ctx: ProbeContext): CheckResult {
  const base = {
    id: 'header-breakdown',
    title: 'Full header breakdown',
    tier: 'full',
  } as const

  if (!ctx.fetch.ok) {
    return {
      ...base,
      status: 'fail',
      summary: "Couldn't fetch the site to inspect response headers.",
      detail: ctx.fetch.message,
    }
  }

  const { present, missing } = evaluateSecurityHeaders(ctx.fetch.headers)
  const total = SECURITY_HEADERS.length
  const summary = `${present.length} of ${total} present`
  const detail = missing.length
    ? `Missing: ${missing.map((h) => h.label).join(', ')}`
    : 'All recommended headers present.'

  if (present.length >= total * 0.75) {
    return { ...base, status: 'pass', summary, detail }
  }
  if (present.length >= total * 0.25) {
    return { ...base, status: 'warn', summary, detail }
  }
  return { ...base, status: 'fail', summary, detail }
}
