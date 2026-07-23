'use client'

import { Moon, Sun } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'
import { useTheme } from './theme-provider'

const themeToggleVariants = cva(
  // `focus-ring` (the bare utility, not `focus-visible:`) paints
  // unconditionally per its own compiled rule — it's meant for a
  // non-focusable wrapper standing in for a real focusable descendant, not
  // a real `<button>` like this one, which the universal `:focus-visible`
  // rule in focus-ring.css already covers on its own.
  'group relative inline-flex items-center justify-center border border-border-strong bg-surface text-foreground transition-colors hover:bg-surface-2',
  {
    variants: {
      variant: {
        /** Bordered pill, label visible at `sm`+ — the dashboard's own mode-toggle rhythm. */
        pill: 'gap-2 rounded-full px-3 py-1 text-xs font-semibold',
        /** Circular, icon-only at every width — label moves to a hover/focus tooltip instead. */
        icon: 'h-8 w-8 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'pill',
    },
  },
)

export interface ThemeToggleProps extends VariantProps<
  typeof themeToggleVariants
> {
  className?: string
}

/**
 * Flips the app's global theme preference (shared with every other surface
 * via `ThemeProvider`) and remembers the choice in localStorage.
 */
export function ThemeToggle({ variant, className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()

  const label = theme === 'dark' ? 'View light' : 'View dark'
  const isIcon = variant === 'icon'

  return (
    <button
      type="button"
      aria-pressed={theme === 'light'}
      aria-label={isIcon ? label : undefined}
      onClick={toggleTheme}
      className={cn(themeToggleVariants({ variant }), className)}
    >
      {/* Fixed-height slot (matches the label's line-height) so the button
          is the same height icon-only below `sm` as it is with the label
          showing. */}
      <span className="inline-flex h-4 w-4 items-center justify-center">
        {theme === 'dark' ? (
          <Moon aria-hidden="true" size={13} />
        ) : (
          <Sun aria-hidden="true" size={13} />
        )}
      </span>
      {isIcon ? (
        // Decorative — the button's own aria-label already announces this
        // to screen readers, so the hover/focus tooltip stays presentation-only.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2 scale-95 rounded-md border border-border-strong bg-surface-3 px-2 py-1 text-2xs font-semibold whitespace-nowrap text-foreground opacity-0 shadow-card transition-[opacity,transform] duration-150 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
        >
          {label}
        </span>
      ) : (
        // Icon-only below sm — the label stays in the DOM (sr-only) so the
        // accessible name doesn't depend on viewport width.
        <span className="sr-only sm:not-sr-only">{label}</span>
      )}
    </button>
  )
}
