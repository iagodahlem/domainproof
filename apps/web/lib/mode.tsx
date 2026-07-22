'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Mode } from './api/dashboard'

const STORAGE_KEY = 'dp_mode'
const DEFAULT_MODE: Mode = 'test'

/** The only routes whose list data `?mode=` actually filters — the natural
 * places for the global toggle to reflect into the URL (deep-linkable,
 * shareable). Every other dashboard route reads/writes mode through
 * context + localStorage only, same as the design-system's theme toggle. */
const MODE_AWARE_SEGMENTS = ['domains', 'events', 'webhooks']

function isMode(value: string | null): value is Mode {
  return value === 'test' || value === 'live'
}

interface ModeContextValue {
  mode: Mode
  setMode: (mode: Mode) => void
}

const ModeContext = createContext<ModeContextValue | null>(null)

/**
 * Global test/live toggle state for the dashboard. Defaults to `test` on
 * first render (SSR-safe — matches the design-system theme toggle's own
 * default-then-sync-from-storage pattern rather than reading `localStorage`
 * during render). On mount: an explicit `?mode=` in the URL wins and is
 * saved as the new default; otherwise the stored default is read and, if
 * we're on a mode-aware route, pushed into the URL so the page's server
 * data actually reflects it instead of silently disagreeing with the
 * switch.
 */
export function ModeProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mode, setModeState] = useState<Mode>(DEFAULT_MODE)

  const isModeAwarePath = useCallback(
    (path: string) =>
      MODE_AWARE_SEGMENTS.includes(path.split('/').filter(Boolean).pop() ?? ''),
    [],
  )

  useEffect(() => {
    const fromUrl = searchParams.get('mode')
    if (isMode(fromUrl)) {
      setModeState(fromUrl)
      window.localStorage.setItem(STORAGE_KEY, fromUrl)
      return
    }

    const stored = window.localStorage.getItem(STORAGE_KEY)
    const resolved = isMode(stored) ? stored : DEFAULT_MODE
    setModeState(resolved)

    if (resolved !== DEFAULT_MODE && isModeAwarePath(pathname)) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('mode', resolved)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
    // Runs once on mount only — the switch's own setMode below is what
    // reacts to subsequent user-driven changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setMode = useCallback(
    (next: Mode) => {
      setModeState(next)
      window.localStorage.setItem(STORAGE_KEY, next)

      if (isModeAwarePath(pathname)) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('mode', next)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      }
    },
    [isModeAwarePath, pathname, router, searchParams],
  )

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode(): ModeContextValue {
  const context = useContext(ModeContext)
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider')
  }
  return context
}
