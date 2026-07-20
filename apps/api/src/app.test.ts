import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createDb, type Database } from '@infra/db/client'
import type { SessionVerifier } from '@modules/accounts/ports'

// Shared by every describe block below — a real Database, per this repo's
// convention of exercising the actual app.ts wiring end to end rather than
// building each block its own throwaway client.
const db: Database = createDb(
  process.env.DATABASE_URL ??
    'postgres://domainproof:domainproof@localhost:5432/domainproof',
)

const app = createApp({ db })

describe('GET /health', () => {
  it('returns 200 with ok status and a version', async () => {
    const res = await app.request('/health')

    expect(res.status).toBe(200)

    const body = (await res.json()) as { status: string; version: string }
    expect(body.status).toBe('ok')
    expect(typeof body.version).toBe('string')
  })
})

describe('unmatched routes', () => {
  it('returns a JSON 404', async () => {
    const res = await app.request('/does-not-exist')

    expect(res.status).toBe(404)

    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })
})

// Both planes reachable with no host restriction configured is already
// proven by every other test in this file and by apis/v1/routes/domains.test.ts
// and apis/dashboard/routes/keys.test.ts, all of which build their app
// with no publicApiHost/dashboardApiHost override. The middleware's own
// matching behavior (wrong plane 404s, unknown host serves both, port
// stripping) is covered in isolation by
// shared/middlewares/host-restriction.test.ts. This block is the one place
// that proves the real wiring in app.ts — env-driven config, mounted ahead
// of both real plane routers — behaves the same way end to end.
describe('host restriction (real app wiring)', () => {
  // A dummy verifier is enough: these tests send no Authorization header,
  // so session-auth middleware 401s before ever calling `verify`. Its only
  // job is to be truthy, so the dashboard plane doesn't 500 with
  // `auth_not_configured` instead of reaching (and rejecting from) the
  // route.
  const sessionVerifier: SessionVerifier = {
    verify: async () => ({ ok: false, reason: 'invalid_or_expired' }),
  }

  function buildApp(overrides: {
    publicApiHost?: string
    dashboardApiHost?: string
  }) {
    return createApp({ db, sessionVerifier, ...overrides })
  }

  it('serves only /v1 on the configured public host', async () => {
    const restrictedApp = buildApp({ publicApiHost: 'api.domainproof.dev' })

    const v1 = await restrictedApp.request('/v1/domains', {
      headers: { host: 'api.domainproof.dev' },
    })
    expect(v1.status).toBe(401)
    expect(((await v1.json()) as { error: { code: string } }).error.code).toBe(
      'invalid_api_key',
    )

    const dashboard = await restrictedApp.request('/dashboard/keys', {
      headers: { host: 'api.domainproof.dev' },
    })
    expect(dashboard.status).toBe(404)
    expect(
      ((await dashboard.json()) as { error: { code: string } }).error.code,
    ).toBe('not_found')
  })

  it('serves only /dashboard on the configured dashboard host', async () => {
    const restrictedApp = buildApp({
      dashboardApiHost: 'dashboard.api.domainproof.dev',
    })

    const dashboard = await restrictedApp.request('/dashboard/keys', {
      headers: { host: 'dashboard.api.domainproof.dev' },
    })
    expect(dashboard.status).toBe(401)

    const v1 = await restrictedApp.request('/v1/domains', {
      headers: { host: 'dashboard.api.domainproof.dev' },
    })
    expect(v1.status).toBe(404)
    expect(((await v1.json()) as { error: { code: string } }).error.code).toBe(
      'not_found',
    )
  })

  it('serves both planes on an unmatched host even when both are configured', async () => {
    const restrictedApp = buildApp({
      publicApiHost: 'api.domainproof.dev',
      dashboardApiHost: 'dashboard.api.domainproof.dev',
    })

    const v1 = await restrictedApp.request('/v1/domains', {
      headers: { host: 'my-service.up.railway.app' },
    })
    const dashboard = await restrictedApp.request('/dashboard/keys', {
      headers: { host: 'my-service.up.railway.app' },
    })

    expect(v1.status).toBe(401)
    expect(dashboard.status).toBe(401)
  })
})
