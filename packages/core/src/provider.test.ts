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

  it('detects godaddy from a matching nameserver suffix', () => {
    expect(
      detectProvider(['ns71.domaincontrol.com', 'ns72.domaincontrol.com']),
    ).toBe('godaddy')
  })

  it('is case-insensitive for godaddy', () => {
    expect(detectProvider(['NS71.DOMAINCONTROL.COM'])).toBe('godaddy')
  })

  it('detects vercel from a matching nameserver suffix', () => {
    expect(
      detectProvider(['ns1.vercel-dns.com', 'ns2.vercel-dns.com']),
    ).toBe('vercel')
  })

  it('is case-insensitive for vercel', () => {
    expect(detectProvider(['NS1.VERCEL-DNS.COM'])).toBe('vercel')
  })

  it('does not mistake a vercel per-record target hostname for vercel nameservers', () => {
    expect(detectProvider(['ns1.vercel-dns-016.com'])).toBe('unknown')
  })

  it.each(['com', 'net', 'org', 'co.uk'])(
    'detects route53 from an awsdns- nameserver on a .%s tld',
    (tld) => {
      expect(detectProvider([`ns-2048.awsdns-64.${tld}`])).toBe('route53')
    },
  )

  it('is case-insensitive for route53', () => {
    expect(detectProvider(['NS-2048.AWSDNS-64.COM'])).toBe('route53')
  })

  it('returns unknown for a non-matching provider', () => {
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

  it('does not match a lookalike domain that merely contains awsdns- as a substring elsewhere', () => {
    expect(detectProvider(['awsdns-64.evil.example'])).toBe('unknown')
  })
})
