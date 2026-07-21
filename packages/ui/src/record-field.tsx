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
}

export function RecordField({
  label,
  value,
  compact = false,
  copyable = false,
  copyLabel = 'Copy',
  explain,
  className,
  ...props
}: RecordFieldProps) {
  return (
    <CardRow className={cn(compact && 'px-4 py-3', className)} {...props}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="w-[92px] flex-shrink-0 font-mono text-2xs tracking-[0.06em] text-text-faint uppercase max-[560px]:w-auto">
          {label}
        </span>
        <span
          className={cn(
            'min-w-[180px] flex-1 font-mono break-all text-text',
            compact ? 'text-sm' : 'text-base',
          )}
        >
          {value}
        </span>
        {copyable ? (
          <CopyButton value={value} size="sm">
            {copyLabel}
          </CopyButton>
        ) : null}
      </div>
      {explain ? (
        <div className="mt-2 max-w-[58ch] pl-[calc(92px+1rem)] text-sm text-text-muted max-[560px]:pl-0">
          {explain}
        </div>
      ) : null}
    </CardRow>
  )
}
