import { AlertTriangle, Check, Loader2, Lock, X } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { cn } from '@domainproof/ui'
import type { CheckStatus } from '../_lib/types'

export type DisplayStatus = CheckStatus | 'pending' | 'locked'

const iconCircleVariants = cva(
  'flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full',
  {
    variants: {
      status: {
        pass: 'bg-sg-sage-soft text-sg-sage-text',
        warn: 'bg-sg-amber-soft text-sg-amber-text',
        fail: 'bg-sg-red-soft text-sg-red-text',
        pending: 'bg-sg-paper-2 text-sg-ink-faint',
        locked: 'bg-sg-paper-3 text-sg-ink-faint',
      },
    },
  },
)

const badgeVariants = cva(
  'shrink-0 rounded-full px-2.5 py-1 font-sg-body text-2xs font-bold uppercase tracking-wide',
  {
    variants: {
      status: {
        pass: 'bg-sg-sage-soft text-sg-sage-text',
        warn: 'bg-sg-amber-soft text-sg-amber-text',
        fail: 'bg-sg-red-soft text-sg-red-text',
        pending: 'border border-sg-line bg-sg-paper-2 text-sg-ink-faint',
        locked: 'border border-sg-line bg-sg-paper-2 text-sg-ink-faint',
      },
    },
  },
)

const STATUS_ICON: Record<DisplayStatus, typeof Check> = {
  pass: Check,
  warn: AlertTriangle,
  fail: X,
  pending: Loader2,
  locked: Lock,
}

const STATUS_LABEL: Record<DisplayStatus, string> = {
  pass: 'Pass',
  warn: 'Warn',
  fail: 'Fail',
  pending: 'Checking',
  locked: 'Locked',
}

export function CheckStatusIcon({ status }: { status: DisplayStatus }) {
  const Icon = STATUS_ICON[status]
  return (
    <div className={cn(iconCircleVariants({ status }))}>
      <Icon
        aria-hidden="true"
        size={13}
        className={status === 'pending' ? 'animate-spin' : undefined}
      />
    </div>
  )
}

export function CheckStatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={cn(badgeVariants({ status }))}>
      {STATUS_LABEL[status]}
    </span>
  )
}
