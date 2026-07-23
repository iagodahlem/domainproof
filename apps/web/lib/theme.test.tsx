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

  it('applies an already-migrated theme with no legacy key present', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    runNoFoucScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('migrates a legacy dp_theme value into the canonical key and removes the legacy key', () => {
    window.localStorage.setItem('dp_theme', 'light')
    runNoFoucScript()

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(window.localStorage.getItem('dp_theme')).toBeNull()
  })

  it('prefers the canonical key over a stale legacy value when both are present', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    window.localStorage.setItem('dp_theme', 'light')
    runNoFoucScript()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
