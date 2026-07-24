import { describe, expect, it } from 'vitest'
import { validateHostname } from './hostname'

describe('validateHostname', () => {
  it('accepts a bare hostname', () => {
    expect(validateHostname('example.com')).toEqual({
      ok: true,
      domain: 'example.com',
    })
  })

  it('lowercases and strips a scheme, path, and port', () => {
    expect(validateHostname('HTTPS://Example.com:8443/some/path?x=1')).toEqual({
      ok: true,
      domain: 'example.com',
    })
  })

  it('accepts a subdomain', () => {
    expect(validateHostname('app.example.co.uk')).toEqual({
      ok: true,
      domain: 'app.example.co.uk',
    })
  })

  it('rejects an empty string', () => {
    expect(validateHostname('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects an IPv4 address', () => {
    expect(validateHostname('93.184.216.34')).toEqual({
      ok: false,
      reason: 'is_ip',
    })
  })

  it('rejects an IPv6 address', () => {
    expect(validateHostname('::1')).toEqual({ ok: false, reason: 'is_ip' })
  })

  it('rejects a single-label hostname (no TLD)', () => {
    expect(validateHostname('localhost')).toEqual({
      ok: false,
      reason: 'invalid_format',
    })
  })

  it('rejects a hostname with invalid characters', () => {
    expect(validateHostname('exa mple.com')).toEqual({
      ok: false,
      reason: 'invalid_format',
    })
  })

  it('rejects a hostname over 253 characters', () => {
    const label = 'a'.repeat(63)
    const tooLong = `${label}.${label}.${label}.${label}.com`
    expect(validateHostname(tooLong)).toEqual({ ok: false, reason: 'too_long' })
  })
})
