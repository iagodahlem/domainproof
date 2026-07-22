import type { HTMLAttributes, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { CardRow } from './card'
import { CopyButton } from './copy-button'
import { cn } from './cn'

const rowVariants = cva('', {
  variants: {
    compact: {
      true: 'px-4 py-3',
      false: '',
    },
  },
  defaultVariants: {
    compact: false,
  },
})

const labelVariants = cva(
  'flex-shrink-0 font-mono text-2xs tracking-label text-faint-foreground uppercase',
  {
    variants: {
      labelWidth: {
        fixed: 'w-23 max-[560px]:w-auto',
        content: 'w-auto',
      },
    },
    defaultVariants: {
      labelWidth: 'fixed',
    },
  },
)

const valueVariants = cva('flex-1 font-mono text-foreground', {
  variants: {
    truncateValue: {
      true: 'min-w-0 truncate',
      false: 'min-w-45 break-all',
    },
    compact: {
      true: 'text-sm',
      false: 'text-base',
    },
  },
  defaultVariants: {
    truncateValue: false,
    compact: false,
  },
})

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
  /** `fixed` (default): label sized to a shared column width so stacked rows' values line up. `content`: label sizes to its own text instead — for cards where the labels vary widely in length and a shared value column isn't the goal (e.g. TEST KEY / LIVE KEY). */
  labelWidth?: 'fixed' | 'content'
  /** Keeps the value on a single line, ellipsizing the end instead of wrapping — for values that are only ever consumed via the copy button, never read/transcribed in place (e.g. an API key). The full value is still what gets copied; `title` shows it on hover. */
  truncateValue?: boolean
}

export function RecordField({
  label,
  value,
  compact = false,
  copyable = false,
  copyLabel = 'Copy',
  explain,
  action,
  labelWidth = 'fixed',
  truncateValue = false,
  className,
  ...props
}: RecordFieldProps) {
  return (
    <CardRow className={cn(rowVariants({ compact }), className)} {...props}>
      <div className="flex flex-wrap items-center gap-4">
        <span className={labelVariants({ labelWidth })}>{label}</span>
        <span
          className={valueVariants({ truncateValue, compact })}
          title={truncateValue ? value : undefined}
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
        <div className="mt-2 max-w-[58ch] pl-27 text-sm text-muted-foreground max-[560px]:pl-0">
          {explain}
        </div>
      ) : null}
    </CardRow>
  )
}
