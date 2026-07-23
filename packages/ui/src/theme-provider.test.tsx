import { act } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider, useTheme } from './theme-provider'
import { THEME_STORAGE_KEY } from './theme-storage-key'

function installLocalStorageStub() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
    configurable: true,
  })
}

let mediaChangeListener: ((event: { matches: boolean }) => void) | null = null

function installMatchMediaStub() {
  mediaChangeListener = null
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: (
        _event: string,
        listener: typeof mediaChangeListener,
      ) => {
        mediaChangeListener = listener
      },
      removeEventListener: () => {
        mediaChangeListener = null
      },
    }),
    configurable: true,
  })
}

function ThemeProbe() {
  const { theme } = useTheme()
  return <span data-testid="theme">{theme}</span>
}

beforeEach(() => {
  installLocalStorageStub()
  installMatchMediaStub()
})

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeProvider', () => {
  it('adopts the data-theme already stamped by the pre-paint script instead of defaulting to dark', () => {
    document.documentElement.setAttribute('data-theme', 'light')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('follows a live device preference change when the user has no stored override', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('dark')

    act(() => {
      mediaChangeListener?.({ matches: true })
    })

    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('ignores a device preference change once the user has an explicit stored choice', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    act(() => {
      mediaChangeListener?.({ matches: true })
    })

    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })
})
