import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHead({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-[var(--space-3)] border-b border-[var(--border)] bg-[var(--surface-2)] p-[var(--pad-row)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-[var(--pad-card)]', className)} {...props} />
}

export function CardRow({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-b border-[var(--border)] p-[var(--pad-row)] last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}
