import type { ReactNode } from 'react'
import { cn } from './cn'

export interface HeaderProps {
  left: ReactNode
  right?: ReactNode
  className?: string
}

/**
 * Sticky glass chrome shared by every marketing-facing page — height,
 * background, blur, and border live here; each surface only supplies its
 * own left/right content. Left/right slots (rather than plain children)
 * because every current usage is already a two-cluster justify-between
 * layout.
 */
export function Header({ left, right, className }: HeaderProps) {
  return (
    <header
      className={cn(
        // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- one-off glass-header blur amount, no design token for blur; single use
        'sticky top-0 z-10 border-b border-border bg-bg-glass backdrop-blur-[10px] backdrop-saturate-[140%]',
        className,
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        {left}
        {right}
      </div>
    </header>
  )
}
