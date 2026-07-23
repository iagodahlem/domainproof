import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { THEME_STORAGE_KEY } from '@domainproof/ui'
import { NO_FOUC_THEME_SCRIPT } from './theme'

// jsdom under this Node/vitest combo doesn't implement window.localStorage
// (see packages/ui's theme-toggle.test.tsx for the same pattern), so it's
// stubbed with an in-memory Storage-like object here.
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

// jsdom doesn't implement window.matchMedia either, and the script's own
// try/catch would otherwise swallow that as a silent no-op — stubbed here
// so the device-preference and default-dark paths are actually exercised.
function installMatchMediaStub(prefersLight: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: prefersLight,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    configurable: true,
  })
}

function runNoFoucScript() {
  new Function(NO_FOUC_THEME_SCRIPT)()
}

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('NO_FOUC_THEME_SCRIPT', () => {
  it('reads and writes the canonical key exported by @domainproof/ui, not a hand-duplicated literal', () => {
    expect(NO_FOUC_THEME_SCRIPT).toContain(`'${THEME_STORAGE_KEY}'`)
  })

  it('applies a stored theme choice', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    runNoFoucScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('falls back to the device preference when no theme is stored', () => {
    installMatchMediaStub(true)
    runNoFoucScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('defaults to dark when no theme is stored and the device has no light preference', () => {
    installMatchMediaStub(false)
    runNoFoucScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
