import type { HTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

const logoVariants = cva(
  'inline-flex items-center gap-2 font-bold whitespace-nowrap text-text',
  {
    variants: {
      size: {
        default: 'text-lg',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

const logoMarkVariants = cva(
  'flex shrink-0 items-center justify-center rounded-md border border-accent-border bg-accent-soft text-accent',
  {
    variants: {
      size: {
        default: 'h-5.5 w-5.5',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export interface LogoProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof logoVariants> {}

export function Logo({ size, className, ...props }: LogoProps) {
  return (
    <span className={cn(logoVariants({ size }), className)} {...props}>
      <span aria-hidden="true" className={logoMarkVariants({ size })}>
        <Check size={13} strokeWidth={2.2} />
      </span>
      DomainProof
    </span>
  )
}
