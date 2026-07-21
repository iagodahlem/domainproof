import type { HTMLAttributes } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from './cn'

export type CalloutTone = 'warning' | 'accent' | 'neutral'
export type CalloutEmphasis = 'solid' | 'dashed'

const calloutVariants = cva('text-sm text-text-muted', {
  variants: {
    emphasis: {
      solid: 'rounded-lg border border-transparent p-5',
      dashed: 'block border-t border-dashed border-t-border-strong pt-4',
    },
    tone: {
      warning: '',
      accent: '',
      neutral: '',
    },
  },
  compoundVariants: [
    {
      emphasis: 'solid',
      tone: 'warning',
      class:
        'bg-warning-soft border-warning-border [&_strong]:text-warning-strong',
    },
    {
      emphasis: 'solid',
      tone: 'accent',
      class: 'bg-accent-soft border-accent-border-soft [&_strong]:text-accent',
    },
    {
      emphasis: 'solid',
      tone: 'neutral',
      class: 'bg-surface-2 [&_strong]:text-text',
    },
  ],
  defaultVariants: {
    tone: 'neutral',
    emphasis: 'solid',
  },
})

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
      className={cn(calloutVariants({ tone, emphasis }), className)}
      {...props}
    >
      {children}
    </div>
  )
}
