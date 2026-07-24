import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, resetRateLimitForTests } from './rate-limit'

beforeEach(() => {
  resetRateLimitForTests()
  vi.useFakeTimers()
  vi.setSystemTime(0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('checkRateLimit', () => {
  it('allows requests up to the limit', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(
        checkRateLimit('scan:1.2.3.4', { limit: 3, windowMs: 1000 }).allowed,
      ).toBe(true)
    }
  })

  it('blocks the request that exceeds the limit', () => {
    for (let i = 0; i < 3; i += 1) {
      checkRateLimit('scan:1.2.3.4', { limit: 3, windowMs: 1000 })
    }
    const result = checkRateLimit('scan:1.2.3.4', { limit: 3, windowMs: 1000 })
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets the window after windowMs elapses', () => {
    for (let i = 0; i < 3; i += 1) {
      checkRateLimit('scan:1.2.3.4', { limit: 3, windowMs: 1000 })
    }
    vi.setSystemTime(1001)
    expect(
      checkRateLimit('scan:1.2.3.4', { limit: 3, windowMs: 1000 }).allowed,
    ).toBe(true)
  })

  it('tracks separate keys independently', () => {
    for (let i = 0; i < 3; i += 1) {
      checkRateLimit('scan:1.2.3.4', { limit: 3, windowMs: 1000 })
    }
    expect(
      checkRateLimit('scan:5.6.7.8', { limit: 3, windowMs: 1000 }).allowed,
    ).toBe(true)
  })
})
