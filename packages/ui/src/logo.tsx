import type { HTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

const logoVariants = cva(
  'inline-flex items-center gap-2 font-bold whitespace-nowrap text-foreground',
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
  // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- brand mark radius is a fixed 7px by design (owner-specified); rounded-md (10px) reads nearly circular at this size
  'flex shrink-0 items-center justify-center rounded-[7px] border border-accent-tint bg-accent-soft text-accent',
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
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof logoVariants> {
  /** Mark only, no "DomainProof" wordmark — for chrome too narrow to carry it (e.g. the dashboard's mobile strip). */
  iconOnly?: boolean
}

export function Logo({
  size,
  className,
  iconOnly = false,
  ...props
}: LogoProps) {
  return (
    <span className={cn(logoVariants({ size }), className)} {...props}>
      <span aria-hidden="true" className={logoMarkVariants({ size })}>
        <Check size={13} strokeWidth={2.2} />
      </span>
      {iconOnly ? <span className="sr-only">DomainProof</span> : 'DomainProof'}
    </span>
  )
}
