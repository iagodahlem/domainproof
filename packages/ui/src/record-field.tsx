import type { HTMLAttributes, ReactNode } from 'react'
import { CardRow } from './card'
import { CopyButton } from './copy-button'
import { cn } from './cn'

export interface RecordFieldProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode
  value: string
  /** Tighter padding + smaller value size — dashboard detail and onboarding inline uses. */
  compact?: boolean
  copyable?: boolean
  copyLabel?: ReactNode
  explain?: ReactNode
  /** Custom trailing control instead of the copy button — e.g. a "Reveal" action gating a value that isn't safe to copy until shown. Takes precedence over `copyable`. */
  action?: ReactNode
}

export function RecordField({
  label,
  value,
  compact = false,
  copyable = false,
  copyLabel = 'Copy',
  explain,
  action,
  className,
  ...props
}: RecordFieldProps) {
  return (
    <CardRow className={cn(compact && 'px-4 py-3', className)} {...props}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="w-23 flex-shrink-0 font-mono text-2xs tracking-label text-text-faint uppercase max-[560px]:w-auto">
          {label}
        </span>
        <span
          className={cn(
            'min-w-45 flex-1 font-mono break-all text-text',
            compact ? 'text-sm' : 'text-base',
          )}
        >
          {value}
        </span>
        {action ??
          (copyable ? (
            <CopyButton value={value} size="sm">
              {copyLabel}
            </CopyButton>
          ) : null)}
      </div>
      {explain ? (
        <div className="mt-2 max-w-[58ch] pl-27 text-sm text-text-muted max-[560px]:pl-0">
          {explain}
        </div>
      ) : null}
    </CardRow>
  )
}
