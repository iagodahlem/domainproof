import { describe, expect, it } from 'vitest'

import { checkHttp } from './check-http'
import { recordValue } from './record'
import { createFixtureFetcher } from './testing/fixture-fetcher'

const DOMAIN = 'example.com'
const BRAND_SLUG = 'domainproof'
const URL = `https://${DOMAIN}/.well-known/${BRAND_SLUG}-challenge`
const TOKEN = 'expectedtoken1234567890abcd'
const OTHER_TOKEN = 'someothertoken1234567890abcd'

describe('checkHttp', () => {
  it('returns found for an exact match', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 200, body: recordValue(TOKEN, BRAND_SLUG) },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'found',
    })
    expect(fetcher.calls).toEqual([URL])
  })

  it('returns found among noise lines, trailing newline, whitespace, and a quoted line', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: {
        ok: true,
        status: 200,
        body: [
          'not-a-domainproof-line',
          recordValue(OTHER_TOKEN, BRAND_SLUG),
          `  " ${recordValue(TOKEN, BRAND_SLUG)} "  `,
          '',
        ].join('\n'),
      },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'found',
    })
  })

  it('returns wrong_value with the detected token when none match', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: {
        ok: true,
        status: 200,
        body: recordValue(OTHER_TOKEN, BRAND_SLUG),
      },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'wrong_value',
      detected: [OTHER_TOKEN],
    })
  })

  it('caps detected values at 10 entries', async () => {
    const wrongTokens = Array.from({ length: 15 }, (_, i) => `wrong-token-${i}`)
    const fetcher = createFixtureFetcher({
      [URL]: {
        ok: true,
        status: 200,
        body: wrongTokens
          .map((token) => recordValue(token, BRAND_SLUG))
          .join('\n'),
      },
    })

    const result = await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)

    expect(result.outcome).toBe('wrong_value')
    if (result.outcome === 'wrong_value') {
      expect(result.detected).toHaveLength(10)
      expect(result.detected).toEqual(wrongTokens.slice(0, 10))
    }
  })

  it('returns not_found for an empty body', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 200, body: '' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'not_found',
    })
  })

  it('returns not_found when the body has no parseable lines', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 200, body: 'just some unrelated text\n' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'not_found',
    })
  })

  it('returns not_found for a 404', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 404, body: '' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'not_found',
    })
  })

  it('returns not_found for a 410', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 410, body: '' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'not_found',
    })
  })

  it('returns unreachable for a 500', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 500, body: '' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'unreachable',
    })
  })

  it('returns unreachable for a 503', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 503, body: '' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'unreachable',
    })
  })

  it('returns unreachable for a timeout', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: false, reason: 'timeout' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'unreachable',
    })
  })

  it('returns unreachable for a connection failure', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: false, reason: 'connection_failed' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'unreachable',
    })
  })

  it('returns unreachable for a TLS error', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: false, reason: 'tls_error' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'unreachable',
    })
  })

  it('returns unreachable when the body was too large', async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: false, reason: 'too_large' },
    })

    expect(await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)).toEqual({
      outcome: 'unreachable',
    })
  })

  it('uses a branded slug in the URL and only matches under that brand', async () => {
    const brandedUrl = `https://${DOMAIN}/.well-known/acme-challenge`
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 200, body: recordValue(TOKEN, BRAND_SLUG) },
      [brandedUrl]: {
        ok: true,
        status: 200,
        body: recordValue(OTHER_TOKEN, 'acme'),
      },
    })

    const defaultResult = await checkHttp(fetcher, DOMAIN, TOKEN, BRAND_SLUG)
    expect(defaultResult).toEqual({ outcome: 'found' })

    const brandedResult = await checkHttp(fetcher, DOMAIN, OTHER_TOKEN, 'acme')
    expect(brandedResult).toEqual({ outcome: 'found' })
    expect(fetcher.calls).toEqual([URL, brandedUrl])

    // The branded token isn't found under the default (unbranded) path, and
    // vice versa — each brand's file is independent.
    const crossCheck = await checkHttp(fetcher, DOMAIN, OTHER_TOKEN, BRAND_SLUG)
    expect(crossCheck).toEqual({ outcome: 'wrong_value', detected: [TOKEN] })
  })
})
