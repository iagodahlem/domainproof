'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { THEME_STORAGE_KEY } from './theme-storage-key'

export type ThemeOverride = 'dark' | 'light'

/** The tri-state a user actually picks from (e.g. the account menu's theme control): an explicit override, or `'system'` to follow the device and clear any stored override. `theme` stays the resolved binary every consumer other than that control cares about. */
export type ThemePreference = 'system' | ThemeOverride

const DEFAULT_THEME: ThemeOverride = 'dark'
const PREFERS_LIGHT_QUERY = '(prefers-color-scheme: light)'

function isThemeOverride(value: string | null): value is ThemeOverride {
  return value === 'dark' || value === 'light'
}

function resolveSystemTheme(): ThemeOverride {
  return window.matchMedia(PREFERS_LIGHT_QUERY).matches ? 'light' : 'dark'
}

interface ThemeContextValue {
  theme: ThemeOverride
  /** Whether the current `theme` is an explicit stored choice or the resolved device preference — drives which segment the account menu's theme control shows as active. */
  preference: ThemePreference
  toggleTheme: () => void
  /** Sets the tri-state preference: `'system'` clears the stored override (theme then follows the device live); `'light'`/`'dark'` stores that explicit choice, same as `toggleTheme`. */
  setThemePreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Global light/dark preference, shared by every surface (marketing, docs,
 * dashboard, hosted verify page) — the theme is a stored user preference,
 * not a page-scoped setting, so this is meant to mount once at the root
 * layout and live for the whole session rather than per-route. Consumers
 * that used to mount their own copy per route (the dashboard's old
 * provider) would each hold independent state and silently diverge from
 * whatever the rest of the app just did.
 *
 * The host app's pre-paint script resolves and stamps `data-theme` on
 * `<html>` before this ever renders (stored choice, then device
 * `prefers-color-scheme`, then dark) — but the initial render here always
 * starts from `DEFAULT_THEME` regardless, matching what a server render
 * produces (no `document` to read there). Reading the live attribute
 * straight into the `useState` initializer instead would make the client's
 * first hydration pass diverge from the server-rendered markup whenever the
 * resolved theme isn't the default, which React treats as a hydration
 * mismatch and discards/regenerates the affected tree client-side — a
 * bigger flash than the one this is trying to avoid. The `useLayoutEffect`
 * below corrects `theme` from the DOM synchronously after the commit, but
 * still before the browser paints, so there's no visible frame in between.
 *
 * Never removes `data-theme` on unmount: an earlier version of the toggle
 * treated the attribute as page-scoped and stripped it when unmounting,
 * which meant navigating away from the page that owned the toggle silently
 * reset every other surface to the default theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeOverride>(DEFAULT_THEME)
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  useLayoutEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme')
    if (isThemeOverride(attr)) {
      if (attr !== theme) setThemeState(attr)
    } else {
      // No pre-paint script ran (e.g. a consumer that mounts ThemeProvider
      // without one) — stamp the default so the DOM matches React's state.
      document.documentElement.setAttribute('data-theme', theme)
    }
    // The DOM attribute alone can't distinguish "explicit dark" from
    // "system resolved to dark" — that distinction only lives in
    // localStorage, so `preference` is corrected from there instead.
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    setPreferenceState(isThemeOverride(stored) ? stored : 'system')
    // Runs once on mount only; the toggle and the media-query handler below
    // each set the attribute themselves when they change `theme`.
  }, [])

  useEffect(() => {
    // Device preference changes should reflect live — but only until the
    // user makes an explicit choice, which then wins permanently.
    const mediaQuery = window.matchMedia(PREFERS_LIGHT_QUERY)
    function handleMediaChange(event: MediaQueryListEvent) {
      if (isThemeOverride(window.localStorage.getItem(THEME_STORAGE_KEY)))
        return
      const next: ThemeOverride = event.matches ? 'light' : 'dark'
      setThemeState(next)
      document.documentElement.setAttribute('data-theme', next)
    }
    mediaQuery.addEventListener('change', handleMediaChange)
    return () => mediaQuery.removeEventListener('change', handleMediaChange)
    // Runs once on mount only — reads localStorage fresh inside the handler.
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeOverride = current === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
      document.documentElement.setAttribute('data-theme', next)
      setPreferenceState(next)
      return next
    })
  }, [])

  const setThemePreference = useCallback((next: ThemePreference) => {
    const resolved = next === 'system' ? resolveSystemTheme() : next
    if (next === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    }
    document.documentElement.setAttribute('data-theme', resolved)
    setThemeState(resolved)
    setPreferenceState(next)
  }, [])

  return (
    <ThemeContext.Provider
      value={{ theme, preference, toggleTheme, setThemePreference }}
    >
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
