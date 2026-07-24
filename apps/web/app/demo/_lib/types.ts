export type CheckStatus = 'pass' | 'warn' | 'fail'
export type CheckTier = 'teaser' | 'full'

export interface CheckResult {
  id: string
  title: string
  tier: CheckTier
  status: CheckStatus
  summary: string
  detail?: string
}

export interface ScanReport {
  domain: string
  scannedAt: string
  checks: CheckResult[]
}

export type ScanOutcome =
  | { ok: true; report: ScanReport }
  | { ok: false; reason: 'unreachable'; reasons: string[] }
