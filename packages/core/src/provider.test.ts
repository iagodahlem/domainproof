import { describe, expect, it } from 'vitest'

import { detectProvider } from './provider'

describe('detectProvider', () => {
  it('detects cloudflare from a matching nameserver suffix', () => {
    expect(
      detectProvider(['aida.ns.cloudflare.com', 'bob.ns.cloudflare.com']),
    ).toBe('cloudflare')
  })

  it('is case-insensitive', () => {
    expect(detectProvider(['AIDA.NS.CLOUDFLARE.COM'])).toBe('cloudflare')
  })

  it('detects cloudflare when only one of several nameservers matches', () => {
    expect(detectProvider(['ns1.example.com', 'bob.ns.cloudflare.com'])).toBe(
      'cloudflare',
    )
  })

  it('returns unknown for a non-cloudflare provider', () => {
    expect(detectProvider(['ns1.example.com', 'ns2.example.com'])).toBe(
      'unknown',
    )
  })

  it('returns unknown for an empty nameserver list (e.g. a sandbox domain)', () => {
    expect(detectProvider([])).toBe('unknown')
  })

  it('does not match a lookalike domain that merely contains the suffix as a substring elsewhere', () => {
    expect(detectProvider(['notcloudflare.com.evil.example'])).toBe('unknown')
  })
})
