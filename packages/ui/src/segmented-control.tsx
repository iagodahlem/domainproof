'use client'

import { Fragment } from 'react'
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
  /**
   * Accessible name and hover/focus tooltip text for an icon-only option
   * (e.g. the account menu's System/Light/Dark control) — `label` renders
   * as the tab's only visible content with no text of its own, so this
   * fills in for it both as the tab's `aria-label` and as a small tooltip
   * bubble, same visual recipe as `ThemeToggle`'s icon variant. Omit for a
   * text-labeled option, where `label` itself is already the accessible
   * name.
   */
  tooltip?: string
}

export interface SegmentedControlProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  /** `sm` shrinks padding/gap/text for a tight context (e.g. the account menu's theme row) — default fits the dashboard topbar's mode switch. */
  size?: 'default' | 'sm'
  /**
   * Wraps each rendered tab button — the escape hatch for a host that needs
   * to register the tab as something else too (e.g. the account menu wraps
   * each tab in a bare Radix `MenuItem` so it stays keyboard-reachable once
   * it's embedded inside a Radix dropdown, which otherwise traps Tab/Arrow
   * navigation to its own registered Items). The tab's own `onClick` still
   * fires normally either way. Identity by default.
   */
  renderTab?: (tab: ReactNode, option: SegmentedControlOption) => ReactNode
}

const segmentVariants = cva(
  'group relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-faint-foreground transition-colors duration-150 hover:text-foreground',
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
      size: {
        default: 'gap-1.5 px-2.5 py-1 text-xs',
        sm: 'gap-1 px-1.5 py-1 text-2xs',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'default',
    },
  },
)

/**
 * A small tablist of mutually-exclusive options (test/live, all/test/live,
 * System/Light/Dark, ...) — each option can carry its own tone (reusing the
 * mode-pill tones) so the active segment reads the same warning/success
 * language as the badges elsewhere in the product. Same
 * `role="tablist"`/`aria-selected` pattern as `PathChooser`, scaled down
 * for a compact inline control.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  size = 'default',
  renderTab = (tab) => tab,
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
        const tab = (
          <button
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={option.tooltip}
            onClick={() => onChange(option.value)}
            className={segmentVariants({ tone: option.tone, size })}
          >
            {option.tone ? (
              <span
                aria-hidden="true"
                className={dotVariants({ tone: option.tone })}
              />
            ) : null}
            {option.label}
            {option.tooltip ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2 scale-95 rounded-md border border-border-strong bg-surface-3 px-2 py-1 text-2xs font-semibold whitespace-nowrap text-foreground opacity-0 shadow-card transition-[opacity,transform] duration-150 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
              >
                {option.tooltip}
              </span>
            ) : null}
          </button>
        )
        return <Fragment key={option.value}>{renderTab(tab, option)}</Fragment>
      })}
    </div>
  )
}
