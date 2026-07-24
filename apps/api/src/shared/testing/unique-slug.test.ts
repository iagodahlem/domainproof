import { describe, expect, it } from 'vitest'
import { uniqueSlug } from './unique-slug'

describe('uniqueSlug', () => {
  it('appends an 8-character hex suffix to the base', () => {
    expect(uniqueSlug('test')).toMatch(/^test-[0-9a-f]{8}$/)
  })

  it('returns a different value on each call', () => {
    expect(uniqueSlug('test')).not.toBe(uniqueSlug('test'))
  })
})
