import { afterEach, describe, expect, it, vi } from 'vitest'
import { hostedVerificationUrl } from './hosted-verification-url'

describe('hostedVerificationUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds an absolute URL against the current origin', () => {
    expect(hostedVerificationUrl('tok_1')).toBe(
      `${window.location.origin}/verify/tok_1`,
    )
  })

  it('falls back to the origin-relative path when window is unavailable (SSR)', () => {
    vi.stubGlobal('window', undefined)
    expect(hostedVerificationUrl('tok_1')).toBe('/verify/tok_1')
  })
})
