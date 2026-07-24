import { describe, expect, it } from 'vitest'
import { absoluteGuideUrl, guideForProvider } from './provider-guide'

describe('guideForProvider', () => {
  it.each([
    ['cloudflare', 'Cloudflare', 'add-txt-record-cloudflare'],
    ['godaddy', 'GoDaddy', 'add-txt-record-godaddy'],
    ['vercel', 'Vercel', 'add-txt-record-vercel'],
    ['route53', 'AWS Route 53', 'add-txt-record-route53'],
  ] as const)('maps %s to its named guide', (provider, name, slug) => {
    expect(guideForProvider(provider)).toEqual({ name, slug })
  })

  it('falls back to the generic, unnamed guide for unknown', () => {
    expect(guideForProvider('unknown')).toEqual({
      name: null,
      slug: 'add-txt-record',
    })
  })
})

describe('absoluteGuideUrl', () => {
  it('builds a fully-qualified production docs URL for a guide', () => {
    expect(absoluteGuideUrl(guideForProvider('cloudflare'))).toBe(
      'https://domainproof.dev/docs/add-txt-record-cloudflare',
    )
  })
})
