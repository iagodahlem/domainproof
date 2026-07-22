import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

const headerVariants = cva('border-b border-border', {
  variants: {
    variant: {
      glass:
        'sticky top-0 z-10 bg-background-glass backdrop-blur-header backdrop-saturate-[140%]',
      solid: 'bg-surface',
    },
  },
  defaultVariants: {
    variant: 'glass',
  },
})

const headerContainerVariants = cva(
  'flex min-h-16 items-center justify-between',
  {
    variants: {
      variant: {
        glass: 'mx-auto max-w-5xl gap-4 px-6',
        solid: 'flex-wrap gap-3 px-5 max-[640px]:px-4',
      },
    },
    defaultVariants: {
      variant: 'glass',
    },
  },
)

export interface HeaderProps extends VariantProps<typeof headerVariants> {
  left: ReactNode
  right?: ReactNode
  className?: string
  /** Overrides the inner container's own classes (e.g. its horizontal padding) — for a caller that needs to line its content up with a gutter defined outside this component, without duplicating the shared chrome to do it. */
  contentClassName?: string
}

/**
 * Empty chrome shell shared by every page-level header — height, background,
 * border, and container live here; each surface composes its own left/right
 * content, so there's no page-specific logic in this file. `variant="glass"`
 * is the sticky translucent bar used by the marketing pages and the locked
 * create-project screen; `variant="solid"` is the dashboard's full-width
 * topbar next to the sidebar. Left/right slots (rather than plain children)
 * because every current usage is already a two-cluster
 * justify-between layout.
 */
export function Header({
  variant,
  left,
  right,
  className,
  contentClassName,
}: HeaderProps) {
  return (
    <header className={cn(headerVariants({ variant }), className)}>
      <div
        className={cn(headerContainerVariants({ variant }), contentClassName)}
      >
        {left}
        {right}
      </div>
    </header>
  )
}
