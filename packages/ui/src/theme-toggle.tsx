'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from './cn'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'dp-theme'

export interface ThemeToggleProps {
  className?: string
}

/**
 * Flips `data-theme` on the document root and remembers the choice in
 * localStorage. Scoped to whichever pages render it — unmounting resets to
 * the default (dark) rather than leaving an orphaned override for pages
 * that never opted into a toggle at all.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') setTheme(stored)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
    return () => {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [theme])

  return (
    <button
      type="button"
      aria-pressed={theme === 'light'}
      onClick={() =>
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
      }
      className={cn(
        'focus-ring inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2',
        className,
      )}
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
      {/* Icon-only below sm — the label stays in the DOM (sr-only) so the
          accessible name doesn't depend on viewport width. */}
      <span className="sr-only sm:not-sr-only">
        {theme === 'dark' ? 'View light' : 'View dark'}
      </span>
    </button>
  )
}
