import { act } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  const { theme, preference, setThemePreference } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="preference">{preference}</span>
      <button onClick={() => setThemePreference('light')}>light</button>
      <button onClick={() => setThemePreference('dark')}>dark</button>
      <button onClick={() => setThemePreference('system')}>system</button>
    </div>
  )
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

  it('starts with a "system" preference when there is no stored override', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('preference').textContent).toBe('system')
  })

  it('reports the stored override as the preference on mount', () => {
    // The no-FOUC pre-paint script (not simulated here) is what actually
    // stamps this from localStorage before React ever renders — stamped by
    // hand to isolate ThemeProvider's own read of it.
    document.documentElement.setAttribute('data-theme', 'light')
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('preference').textContent).toBe('light')
    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('setThemePreference("light"/"dark") stores an explicit override', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'light' }))
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(screen.getByTestId('preference').textContent).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setThemePreference("system") clears the stored override and follows the device', async () => {
    const user = userEvent.setup()
    document.documentElement.setAttribute('data-theme', 'light')
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('light')

    await user.click(screen.getByRole('button', { name: 'system' }))

    expect(screen.getByTestId('preference').textContent).toBe('system')
    // The stubbed matchMedia always reports `matches: false` (see
    // installMatchMediaStub), i.e. the device prefers dark.
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('a live device change after returning to "system" still applies', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'system' }))

    act(() => {
      mediaChangeListener?.({ matches: true })
    })

    expect(screen.getByTestId('theme').textContent).toBe('light')
  })
})
