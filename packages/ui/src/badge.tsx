import type { HTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-2 py-1 font-mono text-[length:var(--text-2xs)] font-bold uppercase tracking-[0.03em]',
  {
    variants: {
      tone: {
        accent: 'border-accent-border bg-accent-soft text-accent',
        success: 'border-success-border bg-success-soft text-success',
        warning:
          'border-warning-border-strong bg-warning-soft text-warning-strong',
        danger: 'border-danger-border bg-danger-soft text-danger',
        neutral: 'border-transparent bg-surface-3 text-text-muted',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** The mode-pill treatment: same tone fill, no visible border, normal tracking. */
  mode?: boolean
}

export function Badge({ tone, mode = false, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        badgeVariants({ tone }),
        mode && 'border-transparent tracking-normal',
        className,
      )}
      {...props}
    />
  )
}

export interface ProviderBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: ReactNode
}

export function ProviderBadge({
  icon,
  className,
  children,
  ...props
}: ProviderBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-[length:var(--text-xs)] font-semibold text-text-muted',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="inline-flex shrink-0 text-text-faint">{icon}</span>
      ) : null}
      {children}
    </span>
  )
}

const PILL_TONE_CLASSES: Record<Tone, string> = {
  accent: 'border-accent-border-strong bg-accent-soft text-accent',
  success: 'border-success-border-strong bg-success-soft text-success',
  warning: 'border-warning-border-strong bg-warning-soft text-warning-strong',
  danger: 'border-danger-border-strong bg-danger-soft text-danger',
  neutral: 'border-border-strong bg-surface-2 text-text-muted',
}

const DOT_TONE_CLASSES: Record<Tone, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-text-faint',
}

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: 'default' | 'small'
  /** Animates the dot — reserved for the single "current status" hero use. */
  pulse?: boolean
}

export function StatusPill({
  tone = 'neutral',
  size = 'default',
  pulse = false,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border font-heading',
        size === 'default'
          ? 'px-4 py-2 text-[length:var(--text-sm)]'
          : 'w-fit px-3 py-1 text-[length:var(--text-2xs)]',
        PILL_TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          DOT_TONE_CLASSES[tone],
          pulse && 'animate-dp-pulse',
        )}
      />
      {children}
    </span>
  )
}
