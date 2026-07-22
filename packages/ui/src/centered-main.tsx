import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/**
 * Centered content column for a "locked" single-task screen — the
 * create-project flow and the dashboard shell's own error fallback both
 * need the exact same max-width column, vertically and horizontally
 * centered. Not used by the landing page or the design-system catalog,
 * which each lay content out differently inside their own max-w-5xl
 * column, so those keep composing `<main>` by hand.
 */
export function CenteredMain({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn(
        'mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-6 px-6 py-16',
        className,
      )}
      {...props}
    />
  )
}
