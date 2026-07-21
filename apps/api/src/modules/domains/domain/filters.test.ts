import { describe, expect, it } from 'vitest'
import { normalizeDomainFilter } from './filters'

describe('normalizeDomainFilter', () => {
  it('lowercases and trims a domain the same way claimDomain would', () => {
    expect(normalizeDomainFilter('Example.COM')).toBe('example.com')
  })

  it('normalizes a unicode domain to its punycode form', () => {
    expect(normalizeDomainFilter('café.com')).toBe('xn--caf-dma.com')
  })

  it('falls back to the raw input when the value cannot be normalized', () => {
    expect(normalizeDomainFilter('')).toBe('')
    expect(normalizeDomainFilter('not a domain')).toBe('not a domain')
  })
})
