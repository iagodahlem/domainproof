import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/**
 * Base pulse block every loading skeleton composes from — a bare `<div>`
 * (no client interactivity), so a server-rendered `loading.tsx` can use it
 * directly. Callers size it with `h-*`/`w-*` utilities to match the exact
 * shape of the real content it stands in for, same reasoning as
 * `DomainTableRowSkeleton`'s own cells.
 */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-sm bg-surface-3', className)}
      {...props}
    />
  )
}
