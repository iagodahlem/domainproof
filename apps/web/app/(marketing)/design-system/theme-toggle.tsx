'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'design-system-theme'

export function ThemeToggle() {
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
      id="theme-toggle"
      type="button"
      onClick={() =>
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
      }
      className="focus-ring inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
    >
      {theme === 'dark' ? (
        <Moon aria-hidden="true" size={14} />
      ) : (
        <Sun aria-hidden="true" size={14} />
      )}
      {theme === 'dark' ? 'Dark theme' : 'Light theme'}
    </button>
  )
}
