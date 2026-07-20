import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import {
  createHostRestrictionMiddleware,
  type HostRestrictionConfig,
} from './host-restriction'
import { apiError } from '@shared/http-errors'

/**
 * Stands in for `app.ts`'s wiring: the middleware under test mounted at
 * the root, ahead of stub `/v1` and `/dashboard` routers, plus the same
 * `not_found` 404 an unmatched route gets — so "wrong plane" and "no such
 * route at all" are indistinguishable from the response alone, same as
 * the real app.
 */
function buildApp(config: HostRestrictionConfig) {
  const app = new Hono()

  app.use('*', createHostRestrictionMiddleware(config))
  app.get('/v1/domains', (c) => c.json({ plane: 'v1' }))
  app.get('/dashboard/keys', (c) => c.json({ plane: 'dashboard' }))
  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.notFound((c) => c.json(apiError('not_found', 'Route not found'), 404))

  return app
}

describe('createHostRestrictionMiddleware', () => {
  it('serves both planes when neither host is configured', async () => {
    const app = buildApp({})

    const v1 = await app.request('/v1/domains', {
      headers: { host: 'api.domainproof.dev' },
    })
    const dashboard = await app.request('/dashboard/keys', {
      headers: { host: 'dashboard.api.domainproof.dev' },
    })

    expect(v1.status).toBe(200)
    expect(dashboard.status).toBe(200)
  })

  it('serves only the public plane on the configured public host', async () => {
    const app = buildApp({ publicApiHost: 'api.domainproof.dev' })

    const v1 = await app.request('/v1/domains', {
      headers: { host: 'api.domainproof.dev' },
    })
    expect(v1.status).toBe(200)

    const dashboard = await app.request('/dashboard/keys', {
      headers: { host: 'api.domainproof.dev' },
    })
    expect(dashboard.status).toBe(404)
    const body = (await dashboard.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it('serves only the dashboard plane on the configured dashboard host', async () => {
    const app = buildApp({ dashboardApiHost: 'dashboard.api.domainproof.dev' })

    const dashboard = await app.request('/dashboard/keys', {
      headers: { host: 'dashboard.api.domainproof.dev' },
    })
    expect(dashboard.status).toBe(200)

    const v1 = await app.request('/v1/domains', {
      headers: { host: 'dashboard.api.domainproof.dev' },
    })
    expect(v1.status).toBe(404)
    const body = (await v1.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it('serves both planes on an unmatched host even when both are configured', async () => {
    const app = buildApp({
      publicApiHost: 'api.domainproof.dev',
      dashboardApiHost: 'dashboard.api.domainproof.dev',
    })

    for (const host of ['localhost', 'my-service.up.railway.app']) {
      const v1 = await app.request('/v1/domains', { headers: { host } })
      const dashboard = await app.request('/dashboard/keys', {
        headers: { host },
      })
      expect(v1.status).toBe(200)
      expect(dashboard.status).toBe(200)
    }
  })

  it('serves /health on every host regardless of restriction, since it is not a plane route', async () => {
    const app = buildApp({
      publicApiHost: 'api.domainproof.dev',
      dashboardApiHost: 'dashboard.api.domainproof.dev',
    })

    for (const host of [
      'api.domainproof.dev',
      'dashboard.api.domainproof.dev',
      'localhost',
    ]) {
      const health = await app.request('/health', { headers: { host } })
      expect(health.status).toBe(200)
    }
  })

  it('strips the port from the Host header before matching', async () => {
    const app = buildApp({ publicApiHost: 'api.domainproof.dev' })

    const v1 = await app.request('/v1/domains', {
      headers: { host: 'api.domainproof.dev:3001' },
    })
    expect(v1.status).toBe(200)

    const dashboard = await app.request('/dashboard/keys', {
      headers: { host: 'api.domainproof.dev:3001' },
    })
    expect(dashboard.status).toBe(404)
  })
})
