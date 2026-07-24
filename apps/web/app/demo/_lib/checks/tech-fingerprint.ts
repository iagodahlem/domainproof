import type { CheckResult } from '../types'
import type { ProbeContext } from './context'

interface BodyHint {
  pattern: RegExp
  label: string
}

const BODY_HINTS: BodyHint[] = [
  { pattern: /__NEXT_DATA__/, label: 'Next.js' },
  { pattern: /wp-content|wp-includes/i, label: 'WordPress' },
  { pattern: /cdn\.shopify\.com|Shopify\.theme/i, label: 'Shopify' },
  { pattern: /<meta[^>]+name="generator"[^>]+content="([^"]+)"/i, label: '' },
]

function bodyHints(bodySample: string): string[] {
  const hints: string[] = []
  for (const hint of BODY_HINTS) {
    const match = bodySample.match(hint.pattern)
    if (!match) continue
    hints.push(hint.label || (match[1] ?? 'Unknown generator'))
  }
  return hints
}

function headerHints(headers: Headers): string[] {
  const hints: string[] = []
  const server = headers.get('server')
  if (server) hints.push(server)
  const poweredBy = headers.get('x-powered-by')
  if (poweredBy) hints.push(poweredBy)
  if (headers.has('cf-ray')) hints.push('Cloudflare')
  if (headers.has('x-vercel-id') || headers.has('x-vercel-cache')) {
    hints.push('Vercel')
  }
  return hints
}

/**
 * Pattern-matching against headers/HTML only — a real asset inventory needs
 * a paid fingerprinting service or a headless browser, neither of which
 * fits a public on-demand scan. "basic" in the summary is deliberate: this
 * check is informational (never fails), it just says what it could and
 * couldn't tell.
 */
export function techFingerprintCheck(ctx: ProbeContext): CheckResult {
  const base = {
    id: 'tech-fingerprint',
    title: 'Technology fingerprint',
    tier: 'full',
  } as const

  if (!ctx.fetch.ok) {
    return {
      ...base,
      status: 'warn',
      summary: "Couldn't fetch the site to fingerprint its stack.",
      detail: ctx.fetch.message,
    }
  }

  const hints = Array.from(
    new Set([
      ...headerHints(ctx.fetch.headers),
      ...bodyHints(ctx.fetch.bodySample),
    ]),
  )

  if (hints.length === 0) {
    return {
      ...base,
      status: 'warn',
      summary: "Couldn't confidently detect a stack (basic fingerprint only).",
    }
  }

  return {
    ...base,
    status: 'pass',
    summary: `${hints.join(' · ')} (basic fingerprint)`,
  }
}
