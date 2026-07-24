import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return { DATABASE_URL: 'postgres://test', ...overrides }
}

describe('loadEnv', () => {
  describe('VERIFICATION_BASE_URL default', () => {
    it('defaults to the production hosted page when NODE_ENV is production', () => {
      const env = loadEnv(baseEnv({ NODE_ENV: 'production' }))

      expect(env.VERIFICATION_BASE_URL).toBe('https://domainproof.dev/verify')
    })

    it('defaults to the local web app when NODE_ENV is development', () => {
      const env = loadEnv(baseEnv({ NODE_ENV: 'development' }))

      expect(env.VERIFICATION_BASE_URL).toBe('http://localhost:3000/verify')
    })

    it('defaults to the local web app when NODE_ENV is test', () => {
      const env = loadEnv(baseEnv({ NODE_ENV: 'test' }))

      expect(env.VERIFICATION_BASE_URL).toBe('http://localhost:3000/verify')
    })

    it('keeps an explicit value regardless of NODE_ENV', () => {
      const env = loadEnv(
        baseEnv({
          NODE_ENV: 'production',
          VERIFICATION_BASE_URL: 'https://staging.example.com/verify',
        }),
      )

      expect(env.VERIFICATION_BASE_URL).toBe(
        'https://staging.example.com/verify',
      )
    })
  })

  describe('DOMAINPROOF_BASE_URL default', () => {
    it('stays unset when NODE_ENV is production, falling through to the SDK default', () => {
      const env = loadEnv(baseEnv({ NODE_ENV: 'production' }))

      expect(env.DOMAINPROOF_BASE_URL).toBeUndefined()
    })

    it("defaults to this service's own local port when NODE_ENV is development", () => {
      const env = loadEnv(baseEnv({ NODE_ENV: 'development' }))

      expect(env.DOMAINPROOF_BASE_URL).toBe('http://localhost:3001')
    })

    it("defaults to this service's own local port when NODE_ENV is test", () => {
      const env = loadEnv(baseEnv({ NODE_ENV: 'test' }))

      expect(env.DOMAINPROOF_BASE_URL).toBe('http://localhost:3001')
    })

    it('follows a custom PORT in its local default', () => {
      const env = loadEnv(baseEnv({ NODE_ENV: 'development', PORT: '4001' }))

      expect(env.DOMAINPROOF_BASE_URL).toBe('http://localhost:4001')
    })

    it('keeps an explicit value regardless of NODE_ENV', () => {
      const env = loadEnv(
        baseEnv({
          NODE_ENV: 'development',
          DOMAINPROOF_BASE_URL: 'https://staging.api.example.com',
        }),
      )

      expect(env.DOMAINPROOF_BASE_URL).toBe('https://staging.api.example.com')
    })
  })
})
