import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './theme-toggle'

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

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('defaults to the dark theme', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'View light' })).toBeTruthy()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('switches to light on click and back on a second click', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'View light' }))
    expect(screen.getByRole('button', { name: 'View dark' })).toBeTruthy()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    await user.click(screen.getByRole('button', { name: 'View dark' }))
    expect(screen.getByRole('button', { name: 'View light' })).toBeTruthy()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('persists the choice to localStorage and restores it on mount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'View light' }))
    expect(window.localStorage.getItem('dp-theme')).toBe('light')
    unmount()

    render(<ThemeToggle />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'View dark' })).toBeTruthy(),
    )
  })

  it('clears the data-theme override on unmount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'View light' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    unmount()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('merges a passed className', () => {
    render(<ThemeToggle className="ml-2" />)
    expect(screen.getByRole('button').className).toContain('ml-2')
  })
})
