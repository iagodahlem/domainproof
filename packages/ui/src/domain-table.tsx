'use client'

import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge, type Tone } from './badge'
import { cn } from './cn'

const GRID_COLS = 'grid-cols-[20px_1fr_120px_130px_120px_16px] gap-x-4'

const DOT_TONE_CLASSES: Record<Tone, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-text-faint',
}

export function DomainTable({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mb-6 overflow-hidden rounded-lg border border-border',
        className,
      )}
      {...props}
    />
  )
}

export function DomainTableHead({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid items-center border-b border-border bg-surface-2 px-4 py-3 font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-text-faint uppercase max-[760px]:hidden',
        GRID_COLS,
        className,
      )}
      {...props}
    >
      <span />
      <span>Domain</span>
      <span>Provider</span>
      <span>Status</span>
      <span>Last checked</span>
      <span />
    </div>
  )
}

export interface DomainTableRowProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onSelect'
> {
  statusTone: Tone
  statusLabel: ReactNode
  name: ReactNode
  provider?: ReactNode
  lastChecked: ReactNode
  active?: boolean
  onSelect?: () => void
}

export function DomainTableRow({
  statusTone,
  statusLabel,
  name,
  provider,
  lastChecked,
  active = false,
  onSelect,
  className,
  onKeyDown,
  ...props
}: DomainTableRowProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect?.()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'grid items-center border-b border-border px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-surface-2',
        GRID_COLS,
        active && 'bg-accent-soft hover:bg-accent-soft',
        'max-[760px]:flex max-[760px]:flex-wrap max-[760px]:items-center max-[760px]:gap-x-3 max-[760px]:gap-y-2 max-[760px]:p-4',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'h-2 w-2 flex-shrink-0 rounded-full max-[760px]:order-1',
          DOT_TONE_CLASSES[statusTone],
        )}
      />
      <div className="min-w-0 max-[760px]:order-2 max-[760px]:min-w-0 max-[760px]:flex-1">
        <div className="truncate font-mono text-[length:var(--text-md)] font-heading">
          {name}
        </div>
        <div className="mt-[2px] hidden text-[length:var(--text-2xs)] text-text-faint max-[760px]:block">
          {statusLabel} · {lastChecked}
        </div>
      </div>
      <div className="min-w-0 max-[760px]:order-4 max-[760px]:basis-full max-[760px]:pl-[calc(20px+0.75rem)]">
        {provider ?? (
          <span className="text-[length:var(--text-xs)] text-text-faint">
            —
          </span>
        )}
      </div>
      <div className="max-[760px]:order-3">
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>
      <span className="text-[length:var(--text-xs)] text-text-faint max-[760px]:hidden">
        {lastChecked}
      </span>
      <ChevronRight
        aria-hidden="true"
        size={16}
        className="justify-self-end text-text-faint max-[760px]:hidden"
      />
    </div>
  )
}

export function DomainTableRowSkeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid items-center gap-x-4 border-b border-border px-4 py-3 last:border-b-0',
        GRID_COLS,
        className,
      )}
      {...props}
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-surface-3" />
      <span className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-3" />
      <span className="h-4 w-16 animate-pulse rounded-sm bg-surface-3" />
      <span className="h-5 w-20 animate-pulse rounded-sm bg-surface-3" />
      <span className="h-4 w-14 animate-pulse rounded-sm bg-surface-3" />
      <span />
    </div>
  )
}
