'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'

export type ThemeOverride = 'dark' | 'light'

const STORAGE_KEY = 'dp_theme'
const DEFAULT_THEME: ThemeOverride = 'dark'

const FAVICON_HREFS: Record<
  ThemeOverride,
  { svg: string; png32: string; png16: string }
> = {
  dark: {
    svg: '/icon-dark.svg',
    png32: '/icon-dark-32.png',
    png16: '/icon-dark-16.png',
  },
  light: {
    svg: '/icon-light.svg',
    png32: '/icon-light-32.png',
    png16: '/icon-light-16.png',
  },
}

function isThemeOverride(value: string | null): value is ThemeOverride {
  return value === 'dark' || value === 'light'
}

const OVERRIDE_ID_PREFIX = 'dp-theme-favicon-override'

/**
 * Forces the icon links to a specific theme instead of the
 * prefers-color-scheme media queries baked into layout.tsx's metadata —
 * those track the OS setting, which no longer matches the page once the
 * in-app toggle overrides it. Appends its own unconditional `<link>` tags
 * (last in `<head>`, so browsers prefer them over the earlier
 * media-conditioned ones) rather than mutating React's own metadata
 * nodes in place — those get re-rendered on navigation/Fast Refresh, and
 * React has no way to know a node it owns was edited out from under it.
 */
function applyFavicon(theme: ThemeOverride) {
  const hrefs = FAVICON_HREFS[theme]
  upsertIconLink(`${OVERRIDE_ID_PREFIX}-svg`, 'image/svg+xml', hrefs.svg)
  upsertIconLink(`${OVERRIDE_ID_PREFIX}-32`, 'image/png', hrefs.png32, '32x32')
  upsertIconLink(`${OVERRIDE_ID_PREFIX}-16`, 'image/png', hrefs.png16, '16x16')
}

function upsertIconLink(
  id: string,
  type: string,
  href: string,
  sizes?: string,
) {
  let link = document.getElementById(id) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = 'icon'
    link.type = type
    if (sizes) link.sizes.value = sizes
    document.head.appendChild(link)
  }
  link.href = href
}

interface ThemeContextValue {
  theme: ThemeOverride
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Global light/dark override for the dashboard. Defaults to `dark` on
 * first render (SSR-safe, and matches tokens.css's own default
 * presentation), then syncs from `localStorage` on mount — same
 * default-then-sync-from-storage pattern as `ModeProvider`. Only touches
 * `data-theme`/the favicon once an explicit preference exists; absent
 * one, both stay on their existing defaults (forced dark body,
 * system-following favicon) instead of stamping a redundant override.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeOverride>(DEFAULT_THEME)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isThemeOverride(stored)) {
      setThemeState(stored)
      document.documentElement.setAttribute('data-theme', stored)
      applyFavicon(stored)
    }
    // Runs once on mount only.
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeOverride = current === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(STORAGE_KEY, next)
      document.documentElement.setAttribute('data-theme', next)
      applyFavicon(next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
