import type { CheckResult } from '../types'
import type { ProbeContext } from './context'

const WARN_THRESHOLD_MS = 500
const FAIL_THRESHOLD_MS = 1_500

export function responseTimeCheck(ctx: ProbeContext): CheckResult {
  const base = {
    id: 'response-time',
    title: 'Response time',
    tier: 'teaser',
  } as const

  if (!ctx.fetch.ok) {
    return {
      ...base,
      status: 'fail',
      summary: "Couldn't measure response time — the request didn't complete.",
      detail: ctx.fetch.message,
    }
  }

  const { timingMs } = ctx.fetch
  const summary = `${timingMs}ms to first response`

  if (timingMs <= WARN_THRESHOLD_MS) {
    return { ...base, status: 'pass', summary }
  }
  if (timingMs <= FAIL_THRESHOLD_MS) {
    return { ...base, status: 'warn', summary }
  }
  return { ...base, status: 'fail', summary }
}
