import type { CheckResult } from '../types'
import type { ProbeContext } from './context'

const EXPIRY_WARNING_DAYS = 14

export function httpsTlsCheck(ctx: ProbeContext): CheckResult {
  const base = {
    id: 'https-tls',
    title: 'HTTPS & TLS',
    tier: 'teaser',
  } as const

  if (!ctx.tls.ok) {
    return {
      ...base,
      status: 'fail',
      summary: "Couldn't establish a TLS connection on port 443.",
      detail: ctx.tls.message,
    }
  }

  if (!ctx.tls.authorized) {
    return {
      ...base,
      status: 'fail',
      summary: `Certificate is not trusted (${ctx.tls.issuer}).`,
    }
  }

  if (ctx.tls.daysUntilExpiry < 0) {
    return {
      ...base,
      status: 'fail',
      summary: `Certificate expired ${Math.abs(ctx.tls.daysUntilExpiry)} days ago.`,
    }
  }

  if (ctx.tls.daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
    return {
      ...base,
      status: 'warn',
      summary: `Valid certificate · ${ctx.tls.issuer} · expires in ${ctx.tls.daysUntilExpiry} days`,
    }
  }

  return {
    ...base,
    status: 'pass',
    summary: `Valid certificate · ${ctx.tls.issuer} · expires in ${ctx.tls.daysUntilExpiry} days`,
    detail: ctx.tls.protocol ? `Negotiated ${ctx.tls.protocol}` : undefined,
  }
}
