import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

const buttonVariants = cva(
  'inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border font-[var(--font-weight-semibold)] text-[length:var(--text-sm)] text-[color:var(--text)] transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
  {
    variants: {
      variant: {
        default:
          'border-[var(--border-strong)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]',
        primary:
          'border-transparent bg-[var(--accent)] text-[color:var(--accent-foreground)] hover:bg-[var(--accent-strong)] focus-visible:[--focus-ring-color:var(--accent-foreground)]',
        ghost:
          'border-transparent bg-transparent text-[color:var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[color:var(--text)]',
        'danger-ghost':
          'border-[color-mix(in_oklab,var(--danger)_var(--alpha-border),transparent)] bg-transparent text-[color:var(--danger)] hover:bg-[var(--danger-soft)]',
      },
      size: {
        default: 'px-[var(--space-4)] py-[var(--space-2)]',
        sm: 'px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-xs)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      loading = false,
      disabled,
      type = 'button',
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? <ButtonSpinner /> : null}
        {children}
      </button>
    )
  },
)

function ButtonSpinner() {
  return (
    <svg
      className="h-[1em] w-[1em] animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z"
      />
    </svg>
  )
}
