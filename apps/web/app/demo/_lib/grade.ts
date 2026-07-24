import type { CheckResult, CheckStatus } from './types'

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

const STATUS_POINTS: Record<CheckStatus, number> = { pass: 2, warn: 1, fail: 0 }

export interface GradeResult {
  grade: Grade
  label: string
}

export function computeGrade(checks: CheckResult[]): GradeResult {
  const label = `Based on ${checks.length} check${checks.length === 1 ? '' : 's'}`
  if (checks.length === 0) {
    return { grade: 'F', label: 'No data' }
  }

  const earned = checks.reduce(
    (sum, check) => sum + STATUS_POINTS[check.status],
    0,
  )
  const ratio = earned / (checks.length * 2)

  if (ratio >= 0.9) return { grade: 'A', label }
  if (ratio >= 0.75) return { grade: 'B', label }
  if (ratio >= 0.55) return { grade: 'C', label }
  if (ratio >= 0.35) return { grade: 'D', label }
  return { grade: 'F', label }
}
