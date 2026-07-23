'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from './cn'
import { dotVariants } from './badge'
import type { Tone } from './badge'

export interface SegmentedControlOption {
  value: string
  label: ReactNode
  /** Tone for this option's dot and its active-state text/background — omit for a neutral, dot-less option. */
  tone?: Tone
}

export interface SegmentedControlProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
}

const segmentVariants = cva(
  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-faint-foreground transition-colors duration-150 hover:text-foreground',
  {
    variants: {
      tone: {
        accent: 'aria-selected:bg-accent-soft aria-selected:text-accent',
        success: 'aria-selected:bg-success-soft aria-selected:text-success',
        warning:
          'aria-selected:bg-warning-soft aria-selected:text-warning-strong',
        danger: 'aria-selected:bg-danger-soft aria-selected:text-danger',
        neutral: 'aria-selected:bg-surface-3 aria-selected:text-foreground',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

/**
 * A small tablist of mutually-exclusive options (test/live, all/test/live,
 * ...) — each option can carry its own tone (reusing the mode-pill tones)
 * so the active segment reads the same warning/success language as the
 * badges elsewhere in the product. Same `role="tablist"`/`aria-selected`
 * pattern as `PathChooser`, scaled down for a compact inline control.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ...props
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2',
        className,
      )}
      {...props}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={segmentVariants({ tone: option.tone })}
          >
            {option.tone ? (
              <span
                aria-hidden="true"
                className={dotVariants({ tone: option.tone })}
              />
            ) : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
