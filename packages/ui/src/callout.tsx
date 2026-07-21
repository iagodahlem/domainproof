import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type CalloutTone = 'warning' | 'accent' | 'neutral'
export type CalloutEmphasis = 'solid' | 'dashed'

const SOLID_TONE_CLASSES: Record<CalloutTone, string> = {
  warning:
    'bg-[var(--warning-soft)] border-[color-mix(in_oklab,var(--warning)_var(--alpha-border),transparent)] [&_strong]:text-[color:var(--warning-strong)]',
  accent:
    'bg-[var(--accent-soft)] border-[color-mix(in_oklab,var(--accent)_var(--alpha-border-soft),transparent)] [&_strong]:text-[color:var(--accent)]',
  neutral: 'bg-[var(--surface-2)] [&_strong]:text-[color:var(--text)]',
}

export interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CalloutTone
  /** solid (default): filled tinted box. dashed: no fill, top divider only — used for "under the hood" style asides, tone is ignored. */
  emphasis?: CalloutEmphasis
}

export function Callout({
  tone = 'neutral',
  emphasis = 'solid',
  className,
  children,
  ...props
}: CalloutProps) {
  return (
    <div
      className={cn(
        'text-[length:var(--text-sm)] text-[color:var(--text-muted)]',
        emphasis === 'solid'
          ? cn(
              'rounded-[var(--radius-lg)] border border-transparent p-[var(--pad-card)]',
              SOLID_TONE_CLASSES[tone],
            )
          : 'block border-t border-dashed border-t-[var(--border-strong)] pt-[var(--space-4)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
