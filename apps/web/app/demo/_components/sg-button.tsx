import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@domainproof/ui'

const sgButtonVariants = cva(
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full font-sg-body text-xs font-bold transition-transform duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-sg-violet text-sg-paper hover:bg-sg-violet-strong',
        outline:
          'border border-sg-violet-line bg-transparent text-sg-violet-strong hover:bg-sg-violet-soft',
        ghost:
          'border border-sg-line bg-sg-paper-2 text-sg-ink hover:bg-sg-paper-3',
      },
      size: {
        default: 'px-5 py-3 text-sm',
        sm: 'px-4 py-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface SgButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sgButtonVariants> {}

export const SgButton = forwardRef<HTMLButtonElement, SgButtonProps>(
  function SgButton(
    { className, variant, size, type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(sgButtonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)
