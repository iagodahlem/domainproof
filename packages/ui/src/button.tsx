import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

const buttonVariants = cva(
  'inline-flex items-center gap-2 rounded-md border font-semibold text-sm text-text transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
  {
    variants: {
      variant: {
        default: 'border-border-strong bg-surface-2 hover:bg-surface-3',
        primary:
          'border-transparent bg-accent text-accent-foreground hover:bg-accent-strong focus-visible:[--focus-ring-color:var(--accent-foreground)]',
        ghost:
          'border-transparent bg-transparent text-text-muted hover:bg-surface-2 hover:text-text',
        'danger-ghost':
          'border-danger-border bg-transparent text-danger hover:bg-danger-soft',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-3 py-1 text-xs',
      },
      shape: {
        default: '',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'default',
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
      shape,
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
        className={cn(buttonVariants({ variant, size, shape }), className)}
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
