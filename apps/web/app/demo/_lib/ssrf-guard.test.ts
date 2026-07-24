import { describe, expect, it } from 'vitest'
import { createVettedLookup, resolveVettedAddress } from './ssrf-guard'

describe('resolveVettedAddress', () => {
  it('returns the address when it resolves to a public IP', async () => {
    const result = await resolveVettedAddress('public.example', async () => [
      { address: '93.184.216.34', family: 4 },
    ])

    expect(result).toEqual({
      ok: true,
      address: '93.184.216.34',
      family: 4,
    })
  })

  it('skips a private address and picks a public one from the same answer', async () => {
    const result = await resolveVettedAddress('mixed.example', async () => [
      { address: '10.0.0.1', family: 4 },
      { address: '93.184.216.34', family: 4 },
    ])

    expect(result).toEqual({ ok: true, address: '93.184.216.34', family: 4 })
  })

  it('reports blocked when every resolved address is disallowed', async () => {
    const result = await resolveVettedAddress('internal.example', async () => [
      { address: '10.0.0.1', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ])

    expect(result).toEqual({ ok: false, reason: 'blocked' })
  })

  it('reports no_address when resolution itself fails', async () => {
    const result = await resolveVettedAddress('nx.example', async () => {
      throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' })
    })

    expect(result).toEqual({ ok: false, reason: 'no_address' })
  })

  it('resolves a real hostname (localhost) and blocks it — no fake DNS involved', async () => {
    const result = await resolveVettedAddress('localhost')
    expect(result).toEqual({ ok: false, reason: 'blocked' })
  })
})

describe('createVettedLookup', () => {
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

  /**
   * The core redirect-safety property: the SAME lookup function is used for
   * every connection undici opens (see fetch-probe.ts), including the one
   * made after following a redirect to a different host. A public first hop
   * must not grant a private second hop a pass — each hostname is resolved
   * and vetted independently, on its own merits.
   */
  it('independently vets a second, different hostname — a public first hop does not vouch for a private redirect target', async () => {
    const lookup = createVettedLookup(async (hostname) => {
      if (hostname === 'public-first-hop.example') {
        return [{ address: '93.184.216.34', family: 4 }]
      }
      return [{ address: '169.254.169.254', family: 4 }]
    })

    await expect(invoke(lookup, 'public-first-hop.example')).resolves.toEqual({
      address: '93.184.216.34',
      family: 4,
    })

    await expect(
      invoke(lookup, 'evil-redirect-target.example'),
    ).rejects.toThrow()
  })
})
