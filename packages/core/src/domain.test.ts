import { describe, expect, it } from 'vitest'

import { normalizeDomain, registrableDomain } from './domain'

describe('normalizeDomain', () => {
  it('accepts a plain domain', () => {
    expect(normalizeDomain('example.com')).toEqual({
      ok: true,
      domain: 'example.com',
    })
  })

  it('lowercases mixed-case input', () => {
    expect(normalizeDomain('Example.COM')).toEqual({
      ok: true,
      domain: 'example.com',
    })
  })

  it('strips a trailing dot (FQDN form)', () => {
    expect(normalizeDomain('example.com.')).toEqual({
      ok: true,
      domain: 'example.com',
    })
  })

  it('strips scheme, userinfo, port, and path from a pasted URL', () => {
    expect(
      normalizeDomain('https://user:pass@Example.com:8080/verify?x=1'),
    ).toEqual({
      ok: true,
      domain: 'example.com',
    })
  })

  it('strips a bare paste with a path but no scheme', () => {
    expect(normalizeDomain('example.com/some/path')).toEqual({
      ok: true,
      domain: 'example.com',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeDomain('  example.com  ')).toEqual({
      ok: true,
      domain: 'example.com',
    })
  })

  it('accepts a multi-level public suffix (co.uk)', () => {
    expect(normalizeDomain('sub.acme.co.uk')).toEqual({
      ok: true,
      domain: 'sub.acme.co.uk',
    })
  })

  it('rejects an empty string', () => {
    expect(normalizeDomain('')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a whitespace-only string', () => {
    expect(normalizeDomain('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects an IPv4 address', () => {
    expect(normalizeDomain('127.0.0.1')).toEqual({ ok: false, reason: 'is_ip' })
  })

  it('rejects an IPv6 address', () => {
    expect(normalizeDomain('::1')).toEqual({ ok: false, reason: 'is_ip' })
  })

  it('rejects localhost (no public suffix)', () => {
    expect(normalizeDomain('localhost')).toEqual({
      ok: false,
      reason: 'no_public_suffix',
    })
  })

  it('rejects a single-label host with no recognized suffix', () => {
    expect(normalizeDomain('example')).toEqual({
      ok: false,
      reason: 'no_public_suffix',
    })
  })

  it('rejects malformed hostnames with empty labels', () => {
    expect(normalizeDomain('a..b.com')).toEqual({
      ok: false,
      reason: 'invalid_format',
    })
  })

  it('rejects a label with a leading hyphen', () => {
    expect(normalizeDomain('-example.com')).toEqual({
      ok: false,
      reason: 'invalid_format',
    })
  })

  it('rejects a hostname containing whitespace', () => {
    expect(normalizeDomain('exa mple.com')).toEqual({
      ok: false,
      reason: 'invalid_format',
    })
  })

  it('converts an IDN domain (unicode label) to its ASCII punycode form', () => {
    // DNS itself is ASCII-only — node:dns's resolveTxt (and any real
    // nameserver) needs `xn--caf-dma.com`, not `café.com`. Storing the
    // unicode form as-is would claim fine but could never actually verify.
    const result = normalizeDomain('café.com')
    expect(result).toEqual({ ok: true, domain: 'xn--caf-dma.com' })
  })

  it('converts a multi-label IDN domain to punycode per label', () => {
    const result = normalizeDomain('münchen.de')
    expect(result).toEqual({ ok: true, domain: 'xn--mnchen-3ya.de' })
  })

  it('leaves an already-ASCII domain unchanged', () => {
    expect(normalizeDomain('example.com')).toEqual({
      ok: true,
      domain: 'example.com',
    })
  })

  it('converts an IDN domain pasted as a URL, case-insensitively', () => {
    expect(normalizeDomain('https://Café.COM/verify')).toEqual({
      ok: true,
      domain: 'xn--caf-dma.com',
    })
  })

  it('accepts a .test sandbox domain', () => {
    expect(normalizeDomain('verified.test')).toEqual({
      ok: true,
      domain: 'verified.test',
    })
  })

  it('accepts a .test sandbox domain pasted as a URL, any case', () => {
    expect(normalizeDomain('  https://Verified.Test/  ')).toEqual({
      ok: true,
      domain: 'verified.test',
    })
  })

  it('accepts a .test sandbox domain with a + suffix label', () => {
    expect(normalizeDomain('pending-then-verified+run1.test')).toEqual({
      ok: true,
      domain: 'pending-then-verified+run1.test',
    })
  })

  it('accepts a subdomain under a .test sandbox domain', () => {
    expect(normalizeDomain('sub.pending-then-verified+run1.test')).toEqual({
      ok: true,
      domain: 'sub.pending-then-verified+run1.test',
    })
  })

  it('rejects a bare .test with no label', () => {
    expect(normalizeDomain('.test')).toEqual({
      ok: false,
      reason: 'invalid_format',
    })
  })

  it("rejects bare 'test' with no leading label", () => {
    expect(normalizeDomain('test')).toEqual({
      ok: false,
      reason: 'no_public_suffix',
    })
  })
})

describe('registrableDomain', () => {
  it("returns the domain itself when it's already registrable", () => {
    expect(registrableDomain('example.com')).toBe('example.com')
  })

  it('reduces a subdomain to its eTLD+1', () => {
    expect(registrableDomain('sub.acme.co.uk')).toBe('acme.co.uk')
  })

  it('reduces a deep subdomain to its eTLD+1', () => {
    expect(registrableDomain('a.b.sub.acme.co.uk')).toBe('acme.co.uk')
  })

  it('treats <label>.test as its own registrable domain', () => {
    expect(registrableDomain('pending-then-verified+run1.test')).toBe(
      'pending-then-verified+run1.test',
    )
  })

  it('reduces a subdomain of a .test sandbox domain to <label>.test', () => {
    expect(registrableDomain('sub.verified.test')).toBe('verified.test')
  })
})
