import { describe, expect, it } from 'vitest'
import { createVettedLookup } from './ssrf-guard'

function invoke(
  lookup: ReturnType<typeof createVettedLookup>,
  hostname: string,
  options: { all?: boolean } = {},
) {
  return new Promise((resolve, reject) => {
    lookup(
      hostname,
      options as never,
      ((err: unknown, address: unknown, family: unknown) => {
        if (err) reject(err)
        else resolve({ address, family })
      }) as never,
    )
  })
}

describe('createVettedLookup', () => {
  it('calls back with a vetted address in single-address mode', async () => {
    const lookup = createVettedLookup(async () => [
      { address: '93.184.216.34', family: 4 },
    ])

    await expect(invoke(lookup, 'safe-host.example')).resolves.toEqual({
      address: '93.184.216.34',
      family: 4,
    })
  })

  it('errors instead of calling back with a private address', async () => {
    const lookup = createVettedLookup(async () => [
      { address: '10.0.0.1', family: 4 },
    ])

    await expect(invoke(lookup, 'internal.example')).rejects.toThrow()
  })

  it('errors on the cloud metadata address', async () => {
    const lookup = createVettedLookup(async () => [
      { address: '169.254.169.254', family: 4 },
    ])

    await expect(invoke(lookup, 'metadata.example')).rejects.toThrow()
  })

  /**
   * The core redirect-safety property for webhook delivery: the SAME
   * lookup function is used for every connection undici opens (see
   * webhook-sender.ts), including the one made after following a redirect
   * to a different host. An endpoint that looks public on creation must
   * not get a pass for wherever it 302s to at delivery time.
   */
  it('independently vets a second, different hostname — a public first hop does not vouch for a private redirect target', async () => {
    const lookup = createVettedLookup(async (hostname) => {
      if (hostname === 'public-endpoint.example') {
        return [{ address: '93.184.216.34', family: 4 }]
      }
      return [{ address: '169.254.169.254', family: 4 }]
    })

    await expect(invoke(lookup, 'public-endpoint.example')).resolves.toEqual({
      address: '93.184.216.34',
      family: 4,
    })

    await expect(
      invoke(lookup, 'evil-redirect-target.example'),
    ).rejects.toThrow()
  })

  it('resolves a real hostname (localhost) and blocks it — no fake DNS involved', async () => {
    const lookup = createVettedLookup()
    await expect(invoke(lookup, 'localhost')).rejects.toThrow()
  })
})
