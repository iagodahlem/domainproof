'use client'

import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge, dotVariants, type Tone } from './badge'
import { Table, TableBody, TableCell, TableHeader, TableRow } from './table'
import { cn } from './cn'

const GRID_COLS = 'grid-cols-[20px_1fr_120px_130px_120px_16px] gap-x-4'

export function DomainTable({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <Table className={cn('mb-6', className)} {...props}>
      <TableBody>{children}</TableBody>
    </Table>
  )
}

export function DomainTableHead({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <TableHeader
      className={cn(GRID_COLS, 'max-[760px]:hidden', className)}
      {...props}
    >
      <span />
      <span>Domain</span>
      <span>Provider</span>
      <span>Status</span>
      <span>Last checked</span>
      <span />
    </TableHeader>
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
    <TableRow
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        GRID_COLS,
        active && 'bg-accent-soft hover:bg-accent-soft',
        'max-[760px]:flex max-[760px]:flex-wrap max-[760px]:items-center max-[760px]:gap-x-3 max-[760px]:gap-y-2 max-[760px]:p-4',
        className,
      )}
      {...props}
    >
      <TableCell className="max-[760px]:order-1">
        <span className={dotVariants({ tone: statusTone })} />
      </TableCell>
      <TableCell className="max-[760px]:order-2 max-[760px]:flex-1">
        <div className="truncate font-mono text-base font-heading">{name}</div>
        <div className="mt-[2px] hidden text-2xs text-text-faint max-[760px]:block">
          {statusLabel} · {lastChecked}
        </div>
      </TableCell>
      <TableCell className="max-[760px]:order-4 max-[760px]:basis-full max-[760px]:pl-[calc(20px+0.75rem)]">
        {provider ?? <span className="text-xs text-text-faint">—</span>}
      </TableCell>
      <TableCell className="max-[760px]:order-3">
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </TableCell>
      <TableCell className="text-xs text-text-faint max-[760px]:hidden">
        {lastChecked}
      </TableCell>
      <TableCell className="justify-self-end max-[760px]:hidden">
        <ChevronRight
          aria-hidden="true"
          size={16}
          className="text-text-faint"
        />
      </TableCell>
    </TableRow>
  )
}

export function DomainTableRowSkeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <TableRow className={cn(GRID_COLS, className)} {...props}>
      <span className="h-2 w-2 animate-pulse rounded-full bg-surface-3" />
      <span className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-3" />
      <span className="h-4 w-16 animate-pulse rounded-sm bg-surface-3" />
      <span className="h-5 w-20 animate-pulse rounded-sm bg-surface-3" />
      <span className="h-4 w-14 animate-pulse rounded-sm bg-surface-3" />
      <span />
    </TableRow>
  )
}
