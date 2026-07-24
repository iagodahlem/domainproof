import { describe, expect, it } from 'vitest'
import { resolveDemoBaseUrl } from './sdk-client'

describe('resolveDemoBaseUrl', () => {
  it('defaults to the local api port when NODE_ENV is development and unset', () => {
    expect(resolveDemoBaseUrl({ NODE_ENV: 'development' })).toBe(
      'http://localhost:3001',
    )
  })

  it('stays unset when NODE_ENV is production and unset, falling through to the SDK default', () => {
    expect(resolveDemoBaseUrl({ NODE_ENV: 'production' })).toBeUndefined()
  })

  it('keeps an explicit value regardless of NODE_ENV', () => {
    expect(
      resolveDemoBaseUrl({
        NODE_ENV: 'development',
        DEMO_DOMAINPROOF_BASE_URL: 'https://staging.api.example.com',
      }),
    ).toBe('https://staging.api.example.com')

    expect(
      resolveDemoBaseUrl({
        NODE_ENV: 'production',
        DEMO_DOMAINPROOF_BASE_URL: 'https://staging.api.example.com',
      }),
    ).toBe('https://staging.api.example.com')
  })
})
