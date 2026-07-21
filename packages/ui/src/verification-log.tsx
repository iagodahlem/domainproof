import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export interface VerificationLogEntry {
  id: string
  time: ReactNode
  summary: ReactNode
  /** Rendered inside a native <details> "Technical detail" toggle — omit for no expandable detail. */
  detail?: ReactNode
}

export interface VerificationLogProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  title?: ReactNode
  meta?: ReactNode
  entries: VerificationLogEntry[]
  emptyState?: ReactNode
}

export function VerificationLog({
  title = "What we've checked so far",
  meta,
  entries,
  emptyState = 'No checks yet.',
  className,
  ...props
}: VerificationLogProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)] bg-[var(--surface-2)] px-[var(--space-5)] py-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)] font-mono text-[length:var(--text-xs)] font-[var(--font-weight-semibold)] tracking-[0.04em] text-[color:var(--text-muted)]">
          {title}
        </div>
        {meta ? (
          <span className="text-[length:var(--text-xs)] text-[color:var(--text-faint)]">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="px-[var(--space-5)] pt-[var(--space-3)] pb-[var(--space-4)]">
        {entries.length === 0 ? (
          <p className="py-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--text-faint)]">
            {emptyState}
          </p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.id}
              className={cn(
                'flex gap-[var(--space-4)] border-b border-[var(--border)] py-[var(--space-3)]',
                index === entries.length - 1 && 'border-b-0',
              )}
            >
              <span className="w-16 flex-shrink-0 pt-[2px] font-mono text-[length:var(--text-2xs)] text-[color:var(--text-faint)]">
                {entry.time}
              </span>
              <div className="text-[length:var(--text-sm)] leading-[var(--leading-body)] text-[color:var(--text-muted)]">
                {entry.summary}
                {entry.detail ? (
                  <details className="group mt-[var(--space-2)]">
                    <summary className="inline-flex list-none items-center gap-[var(--space-1)] font-mono text-[length:var(--text-2xs)] tracking-[0.05em] text-[color:var(--text-faint)] uppercase before:content-['▸'] before:text-[0.6rem] group-open:before:content-['▾'] [&::-webkit-details-marker]:hidden">
                      Technical detail
                    </summary>
                    <div className="mt-[var(--space-2)] overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-[var(--space-3)] py-[var(--space-2)] font-mono text-[length:var(--text-xs)] whitespace-nowrap">
                      {entry.detail}
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function VerificationLogStatus({
  tone,
  children,
}: {
  tone: 'ok' | 'warn'
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'font-[var(--font-weight-semibold)]',
        tone === 'ok'
          ? 'text-[color:var(--success)]'
          : 'text-[color:var(--warning-strong)]',
      )}
    >
      {children}
    </span>
  )
}
