import type { CheckResult } from '../types'
import type { ProbeContext } from './context'
import {
  evaluateSecurityHeaders,
  SECURITY_HEADERS,
} from './security-headers-shared'

export function securityHeadersCheck(ctx: ProbeContext): CheckResult {
  const base = {
    id: 'security-headers',
    title: 'Security headers',
    tier: 'teaser',
  } as const

  if (!ctx.fetch.ok) {
    return {
      ...base,
      status: 'fail',
      summary: "Couldn't fetch the site to inspect response headers.",
      detail: ctx.fetch.message,
    }
  }

  const { present } = evaluateSecurityHeaders(ctx.fetch.headers)
  const total = SECURITY_HEADERS.length
  const summary = `${present.length} of ${total} recommended headers present`

  if (present.length >= total * 0.75) {
    return { ...base, status: 'pass', summary }
  }
  if (present.length >= total * 0.25) {
    return { ...base, status: 'warn', summary }
  }
  return { ...base, status: 'fail', summary }
}
