import type { CheckResult } from '../types'
import type { ProbeContext } from './context'

function cookieName(setCookie: string): string {
  return setCookie.split('=')[0]?.trim() ?? setCookie
}

function isFullySecured(setCookie: string): boolean {
  const lower = setCookie.toLowerCase()
  return (
    lower.includes('secure') &&
    lower.includes('httponly') &&
    lower.includes('samesite')
  )
}

/** Swapped in for the board's "Historical uptime (30-day)" — see the feasibility audit. Reads the same `Set-Cookie` headers the fetch probe already captured, no extra round trip. */
export function cookieSecurityCheck(ctx: ProbeContext): CheckResult {
  const base = {
    id: 'cookie-security',
    title: 'Cookie & session security',
    tier: 'full',
  } as const

  if (!ctx.fetch.ok) {
    return {
      ...base,
      status: 'fail',
      summary: "Couldn't fetch the site to inspect cookies.",
      detail: ctx.fetch.message,
    }
  }

  const { setCookies } = ctx.fetch
  if (setCookies.length === 0) {
    return {
      ...base,
      status: 'pass',
      summary: 'No cookies set on the homepage response.',
    }
  }

  const secured = setCookies.filter(isFullySecured)
  const names = setCookies.map(cookieName).join(', ')

  if (secured.length === setCookies.length) {
    return {
      ...base,
      status: 'pass',
      summary: `${setCookies.length} of ${setCookies.length} cookies set Secure/HttpOnly/SameSite (${names})`,
    }
  }
  if (secured.length > 0) {
    return {
      ...base,
      status: 'warn',
      summary: `${secured.length} of ${setCookies.length} cookies set Secure/HttpOnly/SameSite (${names})`,
    }
  }
  return {
    ...base,
    status: 'fail',
    summary: `0 of ${setCookies.length} cookies set Secure/HttpOnly/SameSite (${names})`,
  }
}
