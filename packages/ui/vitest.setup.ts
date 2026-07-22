import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

/* jsdom in this Node version ships no localStorage implementation of its
   own (it defers to the platform's, which needs --localstorage-file to
   persist) — components that read/write localStorage would throw on
   `window.localStorage` being undefined without this. */
if (typeof window !== 'undefined' && !window.localStorage) {
  class MemoryStorage implements Storage {
    #store = new Map<string, string>()
    get length() {
      return this.#store.size
    }
    clear() {
      this.#store.clear()
    }
    getItem(key: string) {
      return this.#store.get(key) ?? null
    }
    key(index: number) {
      return Array.from(this.#store.keys())[index] ?? null
    }
    removeItem(key: string) {
      this.#store.delete(key)
    }
    setItem(key: string, value: string) {
      this.#store.set(key, String(value))
    }
  }

  Object.defineProperty(window, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
  })
}
