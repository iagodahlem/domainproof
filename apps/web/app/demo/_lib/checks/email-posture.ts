import type { CheckResult } from '../types'
import type { ProbeContext } from './context'

function findSpf(txt: string[][]): string | null {
  const record = txt.find((chunks) =>
    chunks.join('').toLowerCase().startsWith('v=spf1'),
  )
  return record ? record.join('') : null
}

function findDmarc(
  dmarcTxt: string[][],
): { raw: string; policy: string } | null {
  const record = dmarcTxt.find((chunks) =>
    chunks.join('').toLowerCase().startsWith('v=dmarc1'),
  )
  if (!record) return null
  const raw = record.join('')
  const match = raw.match(/p=(\w+)/i)
  return { raw, policy: match?.[1]?.toLowerCase() ?? 'none' }
}

/**
 * Swapped in for the board's "Blacklist & reputation" — see the feasibility
 * audit. SPF/DMARC are plain DNS lookups; DKIM has no discoverable
 * selector, so it's a best-effort probe against common defaults
 * (dkim-probe.ts) and always labeled that way rather than presented as a
 * definitive absence.
 */
export function emailPostureCheck(ctx: ProbeContext): CheckResult {
  const base = {
    id: 'email-posture',
    title: 'Email posture',
    tier: 'full',
  } as const

  const spf = findSpf(ctx.dns.txt)
  const dmarc = findDmarc(ctx.dns.dmarcTxt)
  const dkimDetected = ctx.dkim.detectedSelectors.length > 0

  const parts: string[] = []
  parts.push(spf ? 'SPF present' : 'SPF missing')
  parts.push(dmarc ? `DMARC present (p=${dmarc.policy})` : 'DMARC missing')
  parts.push(
    dkimDetected
      ? `DKIM detected (${ctx.dkim.detectedSelectors.join(', ')}, best-effort)`
      : 'DKIM not detected on common selectors (best-effort)',
  )
  const summary = parts.join(' · ')

  if (!spf && !dmarc) {
    return { ...base, status: 'fail', summary }
  }

  const dmarcIsEnforced =
    dmarc?.policy === 'quarantine' || dmarc?.policy === 'reject'
  if (spf && dmarcIsEnforced) {
    return { ...base, status: 'pass', summary }
  }

  return { ...base, status: 'warn', summary }
}
