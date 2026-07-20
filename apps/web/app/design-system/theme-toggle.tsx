'use client'

import { useEffect, useState } from 'react'

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
      className="focus-ring inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
      style={{
        borderColor: 'var(--border-strong)',
        background: 'var(--surface)',
        color: 'var(--text)',
      }}
    >
      {theme === 'dark' ? 'Dark theme' : 'Light theme'}
    </button>
  )
}
