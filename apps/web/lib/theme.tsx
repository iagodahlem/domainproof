'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { THEME_STORAGE_KEY } from '@domainproof/ui'

export type ThemeOverride = 'dark' | 'light'

// Superseded by @domainproof/ui's THEME_STORAGE_KEY ('dp-theme') — this app
// used to store the theme under a different key than ThemeToggle, so a
// choice made on one surface silently didn't apply on the other. Read once
// for migration in NO_FOUC_THEME_SCRIPT below, then never written again.
const LEGACY_STORAGE_KEY = 'dp_theme'
const DEFAULT_THEME: ThemeOverride = 'dark'
const PREFERS_LIGHT_QUERY = '(prefers-color-scheme: light)'

/**
 * Sets `data-theme` on `<html>` before React hydrates or CSS paints — the
 * standard no-FOUC pattern. Resolution order: explicit stored choice
 * (migrating a legacy-key value in place on first run), then the device's
 * own `prefers-color-scheme`, then dark. Kept as a plain string template
 * (rather than a function this module calls) since it runs as a standalone
 * inline `<script>` in `RootLayout`'s `<head>`, before React or this file
 * loads — the canonical key still comes from the imported constant via
 * interpolation below, so it can't drift from @domainproof/ui's value.
 */
export const NO_FOUC_THEME_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var s=localStorage.getItem(k);if(s===null){var legacy=localStorage.getItem('${LEGACY_STORAGE_KEY}');if(legacy==='dark'||legacy==='light'){s=legacy;localStorage.setItem(k,legacy);}localStorage.removeItem('${LEGACY_STORAGE_KEY}');}var t=(s==='dark'||s==='light')?s:(matchMedia('${PREFERS_LIGHT_QUERY}').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`

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
const PRELOAD_ID_PREFIX = 'dp-theme-favicon-preload'

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

/**
 * Warms the browser's cache for every favicon asset of both themes, not
 * just the active one — otherwise the first toggle to the theme that
 * hasn't been rendered yet has to fetch its icon files from scratch,
 * and the tab icon doesn't visibly swap on that first click. Uses
 * `rel="prefetch"` (rather than `rel="preload"`, which Chrome warns about
 * when the fetched resource isn't consumed within a few seconds of load —
 * exactly this case, since the inactive theme's icons are fetched for
 * *later*, not immediate, use; and rather than an `Image()` object, which
 * isn't guaranteed to hit the same cache entry a `<link rel="icon">`
 * reuses) and id-guards each href so remounts (Fast Refresh, StrictMode)
 * don't append duplicate `<link>` nodes or refetch what's already cached.
 */
function preloadFavicons() {
  for (const [theme, hrefs] of Object.entries(FAVICON_HREFS)) {
    prefetchImage(`${PRELOAD_ID_PREFIX}-${theme}-svg`, hrefs.svg)
    prefetchImage(`${PRELOAD_ID_PREFIX}-${theme}-32`, hrefs.png32)
    prefetchImage(`${PRELOAD_ID_PREFIX}-${theme}-16`, hrefs.png16)
  }
}

function prefetchImage(id: string, href: string) {
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'prefetch'
  link.as = 'image'
  link.href = href
  document.head.appendChild(link)
}

interface ThemeContextValue {
  theme: ThemeOverride
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Global light/dark override for the dashboard. `NO_FOUC_THEME_SCRIPT`
 * (inlined into `RootLayout`'s `<head>`) already resolves and stamps
 * `data-theme` on `<html>` before this component ever renders, so the
 * lazy `useState` initializer here just reads that attribute back —
 * matching what's already painted instead of racing it. Only the favicon
 * (a React-owned side effect, not paintable by a plain `<script>`) and a
 * live `prefers-color-scheme` listener still need to run from an effect.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeOverride>(() => {
    if (typeof document === 'undefined') return DEFAULT_THEME
    const attr = document.documentElement.getAttribute('data-theme')
    return isThemeOverride(attr) ? attr : DEFAULT_THEME
  })

  useEffect(() => {
    preloadFavicons()
    applyFavicon(theme)

    // Device preference changes should reflect live — but only until the
    // user makes an explicit choice, which then wins permanently.
    const mediaQuery = window.matchMedia(PREFERS_LIGHT_QUERY)
    function handleMediaChange(event: MediaQueryListEvent) {
      if (isThemeOverride(window.localStorage.getItem(THEME_STORAGE_KEY)))
        return
      const next: ThemeOverride = event.matches ? 'light' : 'dark'
      setThemeState(next)
      document.documentElement.setAttribute('data-theme', next)
      applyFavicon(next)
    }
    mediaQuery.addEventListener('change', handleMediaChange)
    return () => mediaQuery.removeEventListener('change', handleMediaChange)
    // Runs once on mount only — reads localStorage fresh inside the handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeOverride = current === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
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
