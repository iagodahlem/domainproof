import { describe, expect, it } from 'vitest'
import { createApp } from '../../app'
import { createDb, type Database } from '@infra/db/client'

const db: Database = createDb(
  process.env.DATABASE_URL ??
    'postgres://domainproof:domainproof@localhost:5432/domainproof',
)

function buildApp() {
  return createApp({ db })
}

/**
 * The Frontend API plane is the one plane callable from a browser on a
 * third-party origin (see `router.ts`'s doc comment), so it's the one
 * plane with CORS applied — scoped there, not in `shared/middlewares/`, so
 * it can never leak onto `apis/v1` (server-to-server, deliberately no
 * CORS) or `apis/dashboard` (its own independently-scoped CORS).
 */
describe('frontend plane CORS', () => {
  it('answers a cross-origin request with permissive, credential-less CORS headers', async () => {
    const app = buildApp()

    const res = await app.request('/frontend/verifications/unknown-token', {
      headers: { Origin: 'https://example-builder-app.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull()
  })

  it('answers a preflight request with the allowed methods and a cache lifetime', async () => {
    const app = buildApp()

    const res = await app.request('/frontend/verifications/unknown-token', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example-builder-app.com',
        'Access-Control-Request-Method': 'POST',
      },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const allowedMethods = res.headers.get('Access-Control-Allow-Methods')
    expect(allowedMethods).toContain('GET')
    expect(allowedMethods).toContain('POST')
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400')
  })

  it('never applies CORS headers to the v1 plane', async () => {
    const app = buildApp()

    const res = await app.request('/v1/domains', {
      headers: { Origin: 'https://example-builder-app.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
