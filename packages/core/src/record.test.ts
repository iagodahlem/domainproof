import { describe, expect, it } from 'vitest'

import { generateToken } from './token'
import {
  challengeHost,
  parseRecordValue,
  recordValue,
  recordValuePrefix,
  wellKnownUrl,
} from './record'

// Stand-in for a builder's brand slug in tests — core has no notion of a
// "default" brand, so tests that exercise unbranded behavior just pick one
// explicitly, the same way any api caller would.
const BRAND_SLUG = 'domainproof'

describe('challengeHost', () => {
  it('returns the TXT challenge host for a plain domain', () => {
    expect(challengeHost('example.com', BRAND_SLUG)).toBe(
      '_domainproof-challenge.example.com',
    )
  })

  it('returns the TXT challenge host rooted at the registrable domain', () => {
    expect(challengeHost('sub.acme.co.uk', BRAND_SLUG)).toBe(
      '_domainproof-challenge.acme.co.uk',
    )
  })

  it('returns the TXT challenge host for a .test sandbox domain', () => {
    expect(challengeHost('verified.test', BRAND_SLUG)).toBe(
      '_domainproof-challenge.verified.test',
    )
  })

  it('returns a brand-labeled challenge host for a different brand slug', () => {
    expect(challengeHost('sub.acme.co.uk', 'skylane')).toBe(
      '_skylane-challenge.acme.co.uk',
    )
  })

  it('uses a different label per brand for the same domain', () => {
    expect(challengeHost('example.com', 'skylane')).not.toBe(
      challengeHost('example.com', BRAND_SLUG),
    )
  })
})

describe('recordValuePrefix', () => {
  it('builds a brand-specific prefix', () => {
    expect(recordValuePrefix('skylane')).toBe('skylane-verify=')
  })
})

describe('recordValue / parseRecordValue', () => {
  it('round-trips a generated token', () => {
    const token = generateToken()
    const value = recordValue(token, BRAND_SLUG)

    expect(value).toBe(`${recordValuePrefix(BRAND_SLUG)}${token}`)
    expect(parseRecordValue(value, BRAND_SLUG)).toEqual({ ok: true, token })
  })

  it('tolerates surrounding whitespace', () => {
    const token = generateToken()
    const result = parseRecordValue(
      `  ${recordValue(token, BRAND_SLUG)}  \n`,
      BRAND_SLUG,
    )

    expect(result).toEqual({ ok: true, token })
  })

  it('tolerates enclosing double quotes', () => {
    const token = generateToken()
    const result = parseRecordValue(
      `"${recordValue(token, BRAND_SLUG)}"`,
      BRAND_SLUG,
    )

    expect(result).toEqual({ ok: true, token })
  })

  it('tolerates whitespace inside enclosing quotes', () => {
    const token = generateToken()
    const result = parseRecordValue(
      `  " ${recordValue(token, BRAND_SLUG)} "  `,
      BRAND_SLUG,
    )

    expect(result).toEqual({ ok: true, token })
  })

  it('rejects values missing the prefix', () => {
    expect(parseRecordValue('some-other-value=abc', BRAND_SLUG)).toEqual({
      ok: false,
    })
  })

  it('rejects a case-mismatched prefix', () => {
    expect(parseRecordValue('Domainproof-Verify=abc', BRAND_SLUG)).toEqual({
      ok: false,
    })
  })

  it('rejects a bare prefix with no token', () => {
    expect(parseRecordValue(recordValuePrefix(BRAND_SLUG), BRAND_SLUG)).toEqual(
      { ok: false },
    )
  })

  it('rejects an empty string', () => {
    expect(parseRecordValue('', BRAND_SLUG)).toEqual({ ok: false })
  })

  it('round-trips a branded token under its own brand', () => {
    const token = generateToken()
    const value = recordValue(token, 'skylane')

    expect(value).toBe(`skylane-verify=${token}`)
    expect(parseRecordValue(value, 'skylane')).toEqual({ ok: true, token })
  })

  it('does not match a branded record under a different brand', () => {
    const token = generateToken()
    const value = recordValue(token, 'skylane')

    expect(parseRecordValue(value, BRAND_SLUG)).toEqual({ ok: false })
  })

  it('does not match a record under a different brand than it was built with', () => {
    const token = generateToken()
    const value = recordValue(token, BRAND_SLUG)

    expect(parseRecordValue(value, 'skylane')).toEqual({ ok: false })
  })
})

describe('wellKnownUrl', () => {
  it('builds an HTTPS well-known URL under the given brand', () => {
    expect(wellKnownUrl('example.com', BRAND_SLUG)).toBe(
      'https://example.com/.well-known/domainproof-challenge',
    )
  })

  it('uses a different path per brand for the same domain', () => {
    expect(wellKnownUrl('example.com', 'skylane')).toBe(
      'https://example.com/.well-known/skylane-challenge',
    )
  })
})
