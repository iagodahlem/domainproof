import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export function Table({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border',
        className,
      )}
      {...props}
    />
  )
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid items-center border-b border-border bg-surface-2 px-4 py-3 font-mono text-2xs tracking-label text-text-faint uppercase',
        className,
      )}
      {...props}
    />
  )
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid items-center border-b border-border px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-surface-2',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 text-sm', className)} {...props} />
}
