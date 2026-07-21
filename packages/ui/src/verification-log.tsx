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
        'overflow-hidden rounded-lg border border-border',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-2 px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.04em] text-text-muted">
          {title}
        </div>
        {meta ? <span className="text-xs text-text-faint">{meta}</span> : null}
      </div>
      <div className="px-5 pt-3 pb-4">
        {entries.length === 0 ? (
          <p className="py-2 text-sm text-text-faint">{emptyState}</p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.id}
              className={cn(
                'flex gap-4 border-b border-border py-3',
                index === entries.length - 1 && 'border-b-0',
              )}
            >
              <span className="w-16 flex-shrink-0 pt-[2px] font-mono text-2xs text-text-faint">
                {entry.time}
              </span>
              <div className="text-sm leading-body text-text-muted">
                {entry.summary}
                {entry.detail ? (
                  <details className="group mt-2">
                    <summary className="inline-flex list-none items-center gap-1 font-mono text-2xs tracking-[0.05em] text-text-faint uppercase before:content-['▸'] before:text-3xs group-open:before:content-['▾'] [&::-webkit-details-marker]:hidden">
                      Technical detail
                    </summary>
                    <div className="mt-2 overflow-x-auto rounded-sm border border-border bg-bg px-3 py-2 font-mono text-xs whitespace-nowrap">
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
        'font-semibold',
        tone === 'ok' ? 'text-success' : 'text-warning-strong',
      )}
    >
      {children}
    </span>
  )
}
