import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './theme-toggle'
import { ThemeProvider } from './theme-provider'
import { THEME_STORAGE_KEY } from './theme-storage-key'

// jsdom under this Node/vitest combo doesn't implement window.localStorage
// (see the sibling CopyButton test's navigator.clipboard stub for the same
// pattern), so it's stubbed with an in-memory Storage-like object here.
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

// jsdom doesn't implement window.matchMedia either, and ThemeProvider's own
// effect subscribes to it on mount.
function installMatchMediaStub() {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    configurable: true,
  })
}

function renderToggle(props?: {
  variant?: 'pill' | 'icon'
  className?: string
}) {
  return render(
    <ThemeProvider>
      <ThemeToggle {...props} />
    </ThemeProvider>,
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

describe('ThemeToggle', () => {
  it('defaults to the dark theme', () => {
    renderToggle()
    expect(screen.getByRole('button', { name: 'View light' })).toBeTruthy()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('switches to light on click and back on a second click', async () => {
    const user = userEvent.setup()
    renderToggle()

    await user.click(screen.getByRole('button', { name: 'View light' }))
    expect(screen.getByRole('button', { name: 'View dark' })).toBeTruthy()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    await user.click(screen.getByRole('button', { name: 'View dark' }))
    expect(screen.getByRole('button', { name: 'View light' })).toBeTruthy()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('persists the choice to localStorage and restores it on mount', async () => {
    const user = userEvent.setup()
    const { unmount } = renderToggle()

    await user.click(screen.getByRole('button', { name: 'View light' }))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    unmount()

    renderToggle()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'View dark' })).toBeTruthy(),
    )
  })

  it('does not clear the data-theme override when it unmounts', async () => {
    const user = userEvent.setup()
    const { unmount } = renderToggle()

    await user.click(screen.getByRole('button', { name: 'View light' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    unmount()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('shares theme state with another toggle mounted under the same provider', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeToggle variant="icon" />
        <ThemeToggle />
      </ThemeProvider>,
    )

    const toggles = screen.getAllByRole('button', { name: 'View light' })
    await user.click(toggles[0]!)

    expect(screen.getAllByRole('button', { name: 'View dark' })).toHaveLength(2)
  })

  it('merges a passed className', () => {
    renderToggle({ className: 'ml-2' })
    expect(screen.getByRole('button').className).toContain('ml-2')
  })
})

describe('ThemeToggle variant="icon"', () => {
  it('exposes the accessible name via aria-label instead of visible text', () => {
    renderToggle({ variant: 'icon' })
    const button = screen.getByRole('button', { name: 'View light' })
    expect(button.getAttribute('aria-label')).toBe('View light')
  })

  it('still toggles the theme on click', async () => {
    const user = userEvent.setup()
    renderToggle({ variant: 'icon' })

    await user.click(screen.getByRole('button', { name: 'View light' }))
    expect(screen.getByRole('button', { name: 'View dark' })).toBeTruthy()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
