import { describe, expect, it } from 'vitest'
import { isSandboxDomain } from './sandbox'

describe('isSandboxDomain', () => {
  it('is true for a plain .test domain', () => {
    expect(isSandboxDomain('verified.test')).toBe(true)
  })

  it('is true for a .test domain with a + suffix label', () => {
    expect(isSandboxDomain('pending-then-verified+run1.test')).toBe(true)
  })

  it('is true for a subdomain of a .test domain', () => {
    expect(isSandboxDomain('sub.verified.test')).toBe(true)
  })

  it('is false for a real-world domain', () => {
    expect(isSandboxDomain('example.com')).toBe(false)
  })

  it('is false for input that fails normalization', () => {
    expect(isSandboxDomain('')).toBe(false)
  })

  it('is false for a domain that merely contains "test" as a label, not a TLD', () => {
    expect(isSandboxDomain('test.example.com')).toBe(false)
  })
})
