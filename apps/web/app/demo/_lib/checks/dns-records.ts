import type { CheckResult } from '../types'
import type { ProbeContext } from './context'

function hasSpf(txt: string[][]): boolean {
  return txt.some((chunks) =>
    chunks.join('').toLowerCase().startsWith('v=spf1'),
  )
}

function hasDmarc(dmarcTxt: string[][]): boolean {
  return dmarcTxt.some((chunks) =>
    chunks.join('').toLowerCase().startsWith('v=dmarc1'),
  )
}

export function dnsRecordsCheck(ctx: ProbeContext): CheckResult {
  const base = {
    id: 'dns-records',
    title: 'DNS records',
    tier: 'teaser',
  } as const

  const hasMx = ctx.dns.mx.length > 0
  const spf = hasSpf(ctx.dns.txt)
  const dmarc = hasDmarc(ctx.dns.dmarcTxt)

  const found: string[] = []
  const missing: string[] = []
  for (const [present, label] of [
    [hasMx, 'MX'],
    [spf, 'SPF'],
    [dmarc, 'DMARC'],
  ] as const) {
    ;(present ? found : missing).push(label)
  }

  const summary =
    missing.length === 0
      ? `${found.join(', ')} found`
      : `${found.length ? `${found.join(' & ')} found` : 'No mail records found'} · ${missing.join(', ')} not set`

  if (missing.length === 0) {
    return { ...base, status: 'pass', summary }
  }
  if (found.length > 0) {
    return { ...base, status: 'warn', summary }
  }
  return { ...base, status: 'fail', summary }
}
