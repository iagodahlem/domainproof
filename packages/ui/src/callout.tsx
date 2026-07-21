import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type CalloutTone = 'warning' | 'accent' | 'neutral'
export type CalloutEmphasis = 'solid' | 'dashed'

const SOLID_TONE_CLASSES: Record<CalloutTone, string> = {
  warning:
    'bg-warning-soft border-warning-border [&_strong]:text-warning-strong',
  accent: 'bg-accent-soft border-accent-border-soft [&_strong]:text-accent',
  neutral: 'bg-surface-2 [&_strong]:text-text',
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
        'text-[length:var(--text-sm)] text-text-muted',
        emphasis === 'solid'
          ? cn(
              'rounded-lg border border-transparent p-5',
              SOLID_TONE_CLASSES[tone],
            )
          : 'block border-t border-dashed border-t-border-strong pt-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
