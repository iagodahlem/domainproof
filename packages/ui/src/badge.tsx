import type { HTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

const badgeVariants = cva(
  'inline-flex items-center gap-[var(--space-1)] whitespace-nowrap rounded-[var(--radius-sm)] border px-[var(--space-2)] py-[var(--space-1)] font-mono text-[length:var(--text-2xs)] font-[var(--font-weight-bold)] uppercase tracking-[0.03em]',
  {
    variants: {
      tone: {
        accent:
          'border-[color-mix(in_oklab,var(--accent)_var(--alpha-border),transparent)] bg-[var(--accent-soft)] text-[color:var(--accent)]',
        success:
          'border-[color-mix(in_oklab,var(--success)_var(--alpha-border),transparent)] bg-[var(--success-soft)] text-[color:var(--success)]',
        warning:
          'border-[color-mix(in_oklab,var(--warning)_var(--alpha-border-strong),transparent)] bg-[var(--warning-soft)] text-[color:var(--warning-strong)]',
        danger:
          'border-[color-mix(in_oklab,var(--danger)_var(--alpha-border),transparent)] bg-[var(--danger-soft)] text-[color:var(--danger)]',
        neutral:
          'border-transparent bg-[var(--surface-3)] text-[color:var(--text-muted)]',
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
        'inline-flex items-center gap-[var(--space-1)] whitespace-nowrap text-[length:var(--text-xs)] font-[var(--font-weight-semibold)] text-[color:var(--text-muted)]',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="inline-flex shrink-0 text-[color:var(--text-faint)]">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  )
}

const PILL_TONE_CLASSES: Record<Tone, string> = {
  accent:
    'border-[color-mix(in_oklab,var(--accent)_var(--alpha-border-strong),transparent)] bg-[var(--accent-soft)] text-[color:var(--accent)]',
  success:
    'border-[color-mix(in_oklab,var(--success)_var(--alpha-border-strong),transparent)] bg-[var(--success-soft)] text-[color:var(--success)]',
  warning:
    'border-[color-mix(in_oklab,var(--warning)_var(--alpha-border-strong),transparent)] bg-[var(--warning-soft)] text-[color:var(--warning-strong)]',
  danger:
    'border-[color-mix(in_oklab,var(--danger)_var(--alpha-border-strong),transparent)] bg-[var(--danger-soft)] text-[color:var(--danger)]',
  neutral:
    'border-[var(--border-strong)] bg-[var(--surface-2)] text-[color:var(--text-muted)]',
}

const DOT_TONE_CLASSES: Record<Tone, string> = {
  accent: 'bg-[var(--accent)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger: 'bg-[var(--danger)]',
  neutral: 'bg-[var(--text-faint)]',
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
        'inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-full)] border font-[var(--font-weight-heading)]',
        size === 'default'
          ? 'px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--text-sm)]'
          : 'w-fit px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-2xs)]',
        PILL_TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'h-[var(--space-2)] w-[var(--space-2)] shrink-0 rounded-[var(--radius-full)]',
          DOT_TONE_CLASSES[tone],
          pulse && 'animate-dp-pulse',
        )}
      />
      {children}
    </span>
  )
}
