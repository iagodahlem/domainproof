import type { ReactNode } from 'react'
import { CheckStatusBadge, CheckStatusIcon } from './check-status'
import { FULL_TIER_CHECK_TITLES } from '../_lib/full-tier-catalog'
import type { CheckResult } from '../_lib/types'

export function CheckList({ checks }: { checks: CheckResult[] }) {
  return (
    <div className="flex flex-col">
      {checks.map((check) => (
        <div
          key={check.id}
          className="flex items-center gap-3.5 border-t border-sg-line py-3 first:border-t-0 first:pt-0"
        >
          <CheckStatusIcon status={check.status} />
          <div className="min-w-0 flex-1">
            <div className="font-sg-body text-sm font-bold text-sg-ink">
              {check.title}
            </div>
            <div className="font-sg-body text-xs leading-snug text-sg-ink-soft">
              {check.summary}
            </div>
          </div>
          <CheckStatusBadge status={check.status} />
        </div>
      ))}
    </div>
  )
}

export function LockedCheckList() {
  return (
    <div className="flex flex-col">
      {FULL_TIER_CHECK_TITLES.map((title) => (
        <div
          key={title}
          className="flex items-center gap-3.5 border-t border-sg-line py-3 first:border-t-0 first:pt-0"
        >
          <CheckStatusIcon status="locked" />
          <div className="min-w-0 flex-1">
            <div className="font-sg-body text-sm font-bold text-sg-ink-soft">
              {title}
            </div>
            <div
              aria-hidden="true"
              className="mt-1.5 h-2.5 w-40 rounded-full bg-sg-line-strong blur-sm"
            />
            <span className="sr-only">
              Verify ownership to reveal this result
            </span>
          </div>
          <CheckStatusBadge status="locked" />
        </div>
      ))}
    </div>
  )
}

export function CheckSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5.5 mb-1 font-sg-body text-2xs font-bold tracking-wide text-sg-ink-faint uppercase first:mt-0">
      {children}
    </div>
  )
}
