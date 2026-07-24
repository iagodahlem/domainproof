import { createHash, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import {
  DEFAULT_TOKEN_TTL_MS,
  DOMAIN_STATUSES,
  generateToken,
} from '@domainproof/core'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import { env } from '../../../env'
import { createDb, type Database } from '@infra/db/client'
import { accounts, apiKeys, projects } from '@infra/db/schema'
import { generateKeyId } from '@modules/keys/domain/encoding'
import { recordStatusFor } from './domains'

// Auth here goes through the real api-key middleware against real db rows
// (not a fake) — this file is the only end-to-end coverage of `/v1/domains`
// wiring: route mounting, api-key -> project/mode resolution, and the
// project/mode scoping that keeps one key from touching another project's
// (or the wrong mode's) claims. The middleware's own auth behavior is
// covered by `middlewares/api-key.test.ts`.
const db: Database = createDb(
  process.env.DATABASE_URL ??
    'postgres://domainproof:domainproof@localhost:5432/domainproof',
)
const createdClerkUserIds: string[] = []

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

interface TestApiKey {
  projectId: string
  mode: 'test' | 'live'
  slug: string
  key: string
}

async function createTestApiKey(
  overrides: { mode?: 'test' | 'live'; slug?: string; projectId?: string } = {},
): Promise<TestApiKey> {
  const mode = overrides.mode ?? 'live'
  let projectId = overrides.projectId
  let slug = overrides.slug ?? `brand-${randomUUID().slice(0, 8)}`

  if (!projectId) {
    const clerkUserId = `user_${randomUUID()}`
    createdClerkUserIds.push(clerkUserId)

    const [account] = await db
      .insert(accounts)
      .values({ clerkUserId })
      .returning({ id: accounts.id })
    if (!account) throw new Error('failed to create test account')

    const [project] = await db
      .insert(projects)
      .values({ accountId: account.id, name: 'Test project', slug })
      .returning({ id: projects.id, slug: projects.slug })
    if (!project) throw new Error('failed to create test project')

    projectId = project.id
    slug = project.slug
  }

  const keyId = generateKeyId()
  const secret = generateToken()
  await db.insert(apiKeys).values({
    projectId,
    mode,
    keyId,
    secretHash: hashSecret(secret),
    last4: secret.slice(-4),
    name: null,
  })

  return { projectId, mode, slug, key: `dp_${mode}_${keyId}_${secret}` }
}

function buildApp(overrides: { now?: () => Date } = {}) {
  return createApp({ db, ...overrides })
}

async function withKey(
  app: ReturnType<typeof buildApp>,
  key: string,
  path: string,
  init: RequestInit = {},
) {
  return app.request(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${key}` },
  })
}

describe('recordStatusFor', () => {
  it('mirrors the domain status truthfully for every real status', () => {
    expect(recordStatusFor('pending')).toBe('pending')
    expect(recordStatusFor('verified')).toBe('verified')
    expect(recordStatusFor('failed')).toBe('failed')
    expect(recordStatusFor('temporarily_failed')).toBe('temporarily_failed')
  })

  it('falls back to pending for not_started (never happens in practice)', () => {
    expect(recordStatusFor('not_started')).toBe('pending')
  })

  it('covers every DomainStatus', () => {
    expect(DOMAIN_STATUSES.map(recordStatusFor)).toEqual([
      'pending', // not_started -> pending
      'pending',
      'verified',
      'temporarily_failed',
      'failed',
    ])
  })
})

describe('/v1/domains', () => {
  afterEach(async () => {
    while (createdClerkUserIds.length > 0) {
      const clerkUserId = createdClerkUserIds.pop()
      if (clerkUserId) {
        await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
      }
    }
  })

  it('rejects unauthenticated requests', async () => {
    const app = buildApp()
    const res = await app.request('/v1/domains')
    expect(res.status).toBe(401)
  })

  it('claims a domain with a TXT record branded under the project slug', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'Example.com' }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as {
      domain: {
        id: string
        domain: string
        mode: string
        status: string
        verificationUrl: string
        records: Array<{
          type: string
          name: string
          value: string
          purpose: string
          description: string
          status: string
        }>
      }
    }

    expect(body.domain.domain).toBe('example.com')
    expect(body.domain.mode).toBe('live')
    expect(body.domain.status).toBe('pending')
    // Embeds the domain's Frontend API token, not its internal id — see
    // `infra/db/schema.ts`'s `frontendToken` doc comment for why the two
    // are deliberately different values. Built from `env.VERIFICATION_BASE_URL`
    // rather than a hardcoded host, since its default is NODE_ENV-aware.
    expect(
      body.domain.verificationUrl.startsWith(env.VERIFICATION_BASE_URL),
    ).toBe(true)
    expect(body.domain.verificationUrl).toMatch(/\/[a-z2-7]{26}$/)
    expect(body.domain.verificationUrl).not.toContain(body.domain.id)

    expect(body.domain.records).toHaveLength(1)
    const [record] = body.domain.records
    expect(record?.type).toBe('TXT')
    expect(record?.name).toBe(`_${apiKey.slug}-challenge.example.com`)
    expect(record?.value).toMatch(
      new RegExp(`^${apiKey.slug}-verify=[a-z2-7]{26}$`),
    )
    expect(record?.purpose).toBe('ownership')
    expect(record?.status).toBe('pending')
    expect(typeof record?.description).toBe('string')
  })

  it('roots the TXT record at the exact claimed hostname for a subdomain claim', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'app.acme.com' }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as {
      domain: {
        domain: string
        records: Array<{ name: string; description: string }>
      }
    }

    expect(body.domain.domain).toBe('app.acme.com')
    const [record] = body.domain.records
    expect(record?.name).toBe(`_${apiKey.slug}-challenge.app.acme.com`)
    expect(record?.description).toContain('app.acme.com')
  })

  it('roots the TXT record at the exact claimed hostname for a multi-level subdomain claim', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'dashboard.api.acme.com' }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as {
      domain: {
        domain: string
        records: Array<{ name: string; description: string }>
      }
    }

    expect(body.domain.domain).toBe('dashboard.api.acme.com')
    const [record] = body.domain.records
    expect(record?.name).toBe(
      `_${apiKey.slug}-challenge.dashboard.api.acme.com`,
    )
    expect(record?.description).toContain('dashboard.api.acme.com')
  })

  it('rejects an invalid request body', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: '' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('rejects a domain that is not a valid hostname', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: '127.0.0.1' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('rejects a .test sandbox domain claimed with a live-mode key', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey({ mode: 'live' })

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'verified.test' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      error: { code: string; message: string }
    }
    expect(body.error.code).toBe('sandbox_requires_test_mode')
    expect(body.error.message).toBe(
      'Sandbox domains are only available with test keys.',
    )
  })

  it('allows a .test sandbox domain claimed with a test-mode key', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey({ mode: 'test' })

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'verified.test' }),
    })
    expect(res.status).toBe(201)
  })

  it('allows a real domain claimed with a live-mode key (sandbox gate only blocks .test+live)', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey({ mode: 'live' })

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    expect(res.status).toBe(201)
  })

  it('rejects a domain string over 253 characters', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const tooLong = `${'a'.repeat(250)}.com`

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: tooLong }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('returns 409 for a duplicate (project, domain, mode) claim', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const first = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    expect(first.status).toBe(201)

    const second = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    expect(second.status).toBe(409)
    const body = (await second.json()) as { error: { code: string } }
    expect(body.error.code).toBe('domain_already_claimed')
  })

  it('allows the same domain to be claimed again under a different mode', async () => {
    const app = buildApp()
    const liveKey = await createTestApiKey({ mode: 'live' })
    const testKey = await createTestApiKey({
      mode: 'test',
      projectId: liveKey.projectId,
      slug: liveKey.slug,
    })

    const live = await withKey(app, liveKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    expect(live.status).toBe(201)

    const test = await withKey(app, testKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    expect(test.status).toBe(201)
  })

  it('lists only the requesting project and mode’s domains', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const otherKey = await createTestApiKey()

    await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'a.com' }),
    })
    await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'b.com' }),
    })
    await withKey(app, otherKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'c.com' }),
    })

    const res = await withKey(app, apiKey.key, '/v1/domains')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      domains: Array<{ domain: string }>
    }
    expect(body.domains).toHaveLength(2)
    expect(body.domains.map((d) => d.domain).sort()).toEqual(['a.com', 'b.com'])
  })

  it('claims a domain with an external_id and returns it on every response', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        domain: 'example.com',
        external_id: 'customer_1',
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      domain: { external_id: string | null }
    }
    expect(body.domain.external_id).toBe('customer_1')
  })

  it('claims a domain without an external_id, which defaults to null', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      domain: { external_id: string | null }
    }
    expect(body.domain.external_id).toBeNull()
  })

  it('rejects an external_id over 256 characters', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const tooLong = 'a'.repeat(257)

    const res = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com', external_id: tooLong }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('surfaces a component-session claim’s external_id in the list, exactly like a direct v1 claim', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const sessionRes = await withKey(
      app,
      apiKey.key,
      '/v1/component-sessions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ externalId: 'customer_3' }),
      },
    )
    expect(sessionRes.status).toBe(201)
    const { sessionToken } = (await sessionRes.json()) as {
      sessionToken: string
    }

    // No api key here — a drop-in component spends the session token
    // directly, same as a real end user's browser would.
    const claimRes = await app.request(
      `/frontend/component-sessions/${sessionToken}/claim`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain: 'session-claimed.com' }),
      },
    )
    expect(claimRes.status).toBe(201)

    const listRes = await withKey(
      app,
      apiKey.key,
      '/v1/domains?external_id=customer_3',
    )
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as {
      domains: Array<{ domain: string; external_id: string | null }>
    }
    expect(listBody.domains).toHaveLength(1)
    expect(listBody.domains[0]?.domain).toBe('session-claimed.com')
    expect(listBody.domains[0]?.external_id).toBe('customer_3')
  })

  it('filters the list by external_id, matching every domain claimed under it', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        domain: 'customer-a.com',
        external_id: 'customer_1',
      }),
    })
    await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        domain: 'customer-a-alt.com',
        external_id: 'customer_1',
      }),
    })
    await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        domain: 'customer-b.com',
        external_id: 'customer_2',
      }),
    })

    const res = await withKey(
      app,
      apiKey.key,
      '/v1/domains?external_id=customer_1',
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { domains: Array<{ domain: string }> }
    expect(body.domains.map((d) => d.domain).sort()).toEqual([
      'customer-a-alt.com',
      'customer-a.com',
    ])
  })

  it('filters the list by an exact domain match', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'acme.co' }),
    })
    await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'other.co' }),
    })

    const res = await withKey(app, apiKey.key, '/v1/domains?domain=acme.co')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { domains: Array<{ domain: string }> }
    expect(body.domains.map((d) => d.domain)).toEqual(['acme.co'])
  })

  it('combines external_id and domain filters', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'acme.co', external_id: 'customer_1' }),
    })
    await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'other.co', external_id: 'customer_1' }),
    })

    const res = await withKey(
      app,
      apiKey.key,
      '/v1/domains?external_id=customer_1&domain=acme.co',
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { domains: Array<{ domain: string }> }
    expect(body.domains).toHaveLength(1)
    expect(body.domains[0]?.domain).toBe('acme.co')
  })

  it('gets a single domain by id', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const createRes = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    const created = (await createRes.json()) as { domain: { id: string } }

    const getRes = await withKey(
      app,
      apiKey.key,
      `/v1/domains/${created.domain.id}`,
    )
    expect(getRes.status).toBe(200)
    const body = (await getRes.json()) as { domain: { id: string } }
    expect(body.domain.id).toBe(created.domain.id)
  })

  it('returns 404 for an unknown domain id', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, `/v1/domains/${randomUUID()}`)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it("404s (not 403) for another project's domain", async () => {
    const app = buildApp()
    const ownerKey = await createTestApiKey()
    const otherKey = await createTestApiKey()

    const createRes = await withKey(app, ownerKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    const created = (await createRes.json()) as { domain: { id: string } }

    const res = await withKey(
      app,
      otherKey.key,
      `/v1/domains/${created.domain.id}`,
    )
    expect(res.status).toBe(404)
  })

  it('releases a domain, and it is gone afterward', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const createRes = await withKey(app, apiKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    const created = (await createRes.json()) as { domain: { id: string } }

    const deleteRes = await withKey(
      app,
      apiKey.key,
      `/v1/domains/${created.domain.id}`,
      { method: 'DELETE' },
    )
    expect(deleteRes.status).toBe(200)
    const deleted = (await deleteRes.json()) as { domain: { id: string } }
    expect(deleted.domain.id).toBe(created.domain.id)

    const getRes = await withKey(
      app,
      apiKey.key,
      `/v1/domains/${created.domain.id}`,
    )
    expect(getRes.status).toBe(404)
  })

  it("404s (not 403) when releasing another project's domain", async () => {
    const app = buildApp()
    const ownerKey = await createTestApiKey()
    const otherKey = await createTestApiKey()

    const createRes = await withKey(app, ownerKey.key, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    const created = (await createRes.json()) as { domain: { id: string } }

    const res = await withKey(
      app,
      otherKey.key,
      `/v1/domains/${created.domain.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(404)

    // Confirm it's still there under the owner's key — the other project's
    // request didn't just 404, it also didn't delete anything.
    const getRes = await withKey(
      app,
      ownerKey.key,
      `/v1/domains/${created.domain.id}`,
    )
    expect(getRes.status).toBe(200)
  })

  it('returns 404 when releasing an unknown domain id', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, `/v1/domains/${randomUUID()}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(404)
  })

  describe('POST /v1/domains/:id/verify', () => {
    interface VerifyResponseBody {
      domain: { id: string; status: string; records: Array<{ status: string }> }
      check: {
        outcome: string
        checkedAt: string
        expected?: string
        detected?: string[]
        explanation?: string
      }
    }

    async function claimSandboxDomain(
      app: ReturnType<typeof buildApp>,
      apiKey: TestApiKey,
      domain: string,
    ): Promise<string> {
      const res = await withKey(app, apiKey.key, '/v1/domains', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const body = (await res.json()) as { domain: { id: string } }
      return body.domain.id
    }

    async function verify(
      app: ReturnType<typeof buildApp>,
      apiKey: TestApiKey,
      domainId: string,
    ): Promise<{ status: number; body: VerifyResponseBody }> {
      const res = await withKey(
        app,
        apiKey.key,
        `/v1/domains/${domainId}/verify`,
        { method: 'POST' },
      )
      return {
        status: res.status,
        body: (await res.json()) as VerifyResponseBody,
      }
    }

    it("verifies a 'verified.test' sandbox domain immediately", async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey({ mode: 'test' })
      const domainId = await claimSandboxDomain(app, apiKey, 'verified.test')

      const { status, body } = await verify(app, apiKey, domainId)
      expect(status).toBe(200)
      expect(body.check.outcome).toBe('found')
      expect(body.check.checkedAt).toBeDefined()
      expect(body.domain.status).toBe('verified')
      expect(body.domain.records).toHaveLength(1)
      expect(body.domain.records[0]?.status).toBe('verified')
    })

    it("returns the expected/detected mismatch for a 'wrong-value.test' sandbox domain", async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey({ mode: 'test' })
      const domainId = await claimSandboxDomain(app, apiKey, 'wrong-value.test')

      const { status, body } = await verify(app, apiKey, domainId)
      expect(status).toBe(200)
      expect(body.check.outcome).toBe('wrong_value')
      expect(typeof body.check.expected).toBe('string')
      expect(body.check.detected).toEqual(
        expect.arrayContaining([expect.any(String)]),
      )
      // pending -> failed: a wrong-but-valid-looking record is an actionable
      // mismatch, not "still propagating" — see the domains service's
      // eventForCheckOutcome mapping.
      expect(body.domain.status).toBe('failed')
    })

    it("returns a not_found explanation for a 'pending-then-verified.test' domain before its propagation window, then verifies after", async () => {
      let clockOffsetMs = 0
      const app = buildApp({ now: () => new Date(Date.now() + clockOffsetMs) })
      const apiKey = await createTestApiKey({ mode: 'test' })
      const domainId = await claimSandboxDomain(
        app,
        apiKey,
        'pending-then-verified.test',
      )

      const before = await verify(app, apiKey, domainId)
      expect(before.status).toBe(200)
      expect(before.body.check.outcome).toBe('not_found')
      expect(typeof before.body.check.explanation).toBe('string')
      expect(before.body.check.explanation).toContain(
        'pending-then-verified.test',
      )
      expect(before.body.domain.status).toBe('pending')

      // The sandbox's `pending-then-verified` journey answers correctly once
      // 45s have elapsed since the challenge was created — move the
      // injected clock forward instead of sleeping the test.
      clockOffsetMs = 46_000
      const after = await verify(app, apiKey, domainId)
      expect(after.status).toBe(200)
      expect(after.body.check.outcome).toBe('found')
      expect(after.body.domain.status).toBe('verified')
    })

    it('hard-fails a pending domain whose challenge outlived the 72h verification window, without ever checking DNS', async () => {
      let clockOffsetMs = 0
      const app = buildApp({ now: () => new Date(Date.now() + clockOffsetMs) })
      const apiKey = await createTestApiKey({ mode: 'test' })
      // `nxdomain.test` never resolves — proof the expiry guard fires
      // before any DNS check runs, not because the check itself failed.
      const domainId = await claimSandboxDomain(app, apiKey, 'nxdomain.test')

      clockOffsetMs = DEFAULT_TOKEN_TTL_MS
      const { status, body } = await verify(app, apiKey, domainId)
      expect(status).toBe(200)
      expect(body.check.outcome).toBe('expired')
      expect(typeof body.check.explanation).toBe('string')
      expect(body.check.explanation).toContain('72 hours')
      expect(body.domain.status).toBe('failed')
      expect(body.domain.records[0]?.status).toBe('failed')
    })

    it('does not expire a domain that is still inside its verification window', async () => {
      let clockOffsetMs = 0
      const app = buildApp({ now: () => new Date(Date.now() + clockOffsetMs) })
      const apiKey = await createTestApiKey({ mode: 'test' })
      const domainId = await claimSandboxDomain(app, apiKey, 'nxdomain.test')

      clockOffsetMs = DEFAULT_TOKEN_TTL_MS - 1_000
      const { status, body } = await verify(app, apiKey, domainId)
      expect(status).toBe(200)
      expect(body.check.outcome).toBe('not_found') // the real DNS check ran
      expect(body.domain.status).toBe('pending')
    })

    it('does not expire an already-verified domain, even long after the original challenge window', async () => {
      let clockOffsetMs = 0
      const app = buildApp({ now: () => new Date(Date.now() + clockOffsetMs) })
      const apiKey = await createTestApiKey({ mode: 'test' })
      const domainId = await claimSandboxDomain(app, apiKey, 'verified.test')

      const first = await verify(app, apiKey, domainId)
      expect(first.body.domain.status).toBe('verified')

      // Well past the 72h verification window the original challenge was
      // issued under — expiry only ever gates a still-pending domain (see
      // verifyDomain's doc comment), so this recheck runs the DNS check as
      // normal rather than hard-failing on a stale challenge.
      clockOffsetMs = DEFAULT_TOKEN_TTL_MS * 10
      const { status, body } = await verify(app, apiKey, domainId)
      expect(status).toBe(200)
      expect(body.check.outcome).toBe('found')
      expect(body.domain.status).toBe('verified')
    })

    it('returns 404 for an unknown domain id', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()

      const res = await withKey(
        app,
        apiKey.key,
        `/v1/domains/${randomUUID()}/verify`,
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })

    it("404s for another project's domain", async () => {
      const app = buildApp()
      const ownerKey = await createTestApiKey({ mode: 'test' })
      const otherKey = await createTestApiKey({ mode: 'test' })
      const domainId = await claimSandboxDomain(app, ownerKey, 'verified.test')

      const res = await withKey(
        app,
        otherKey.key,
        `/v1/domains/${domainId}/verify`,
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
    })

    it('rejects unauthenticated requests', async () => {
      const app = buildApp()
      const res = await app.request(`/v1/domains/${randomUUID()}/verify`, {
        method: 'POST',
      })
      expect(res.status).toBe(401)
    })
  })

  describe('POST /v1/domains/:id/regenerate', () => {
    interface RegenerateResponseBody {
      domain: {
        id: string
        status: string
        records: Array<{ value: string; status: string }>
      }
    }

    async function claimDomain(
      app: ReturnType<typeof buildApp>,
      apiKey: TestApiKey,
      domain: string,
    ): Promise<{ id: string; recordValue: string }> {
      const res = await withKey(app, apiKey.key, '/v1/domains', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const body = (await res.json()) as {
        domain: { id: string; records: Array<{ value: string }> }
      }
      return {
        id: body.domain.id,
        recordValue: body.domain.records[0]?.value ?? '',
      }
    }

    it('issues a fresh challenge for a pending domain and publishes domain.challenge_regenerated', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const { id: domainId, recordValue: oldRecordValue } = await claimDomain(
        app,
        apiKey,
        'example.com',
      )

      const res = await withKey(
        app,
        apiKey.key,
        `/v1/domains/${domainId}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as RegenerateResponseBody
      expect(body.domain.id).toBe(domainId)
      expect(body.domain.status).toBe('pending')
      expect(body.domain.records).toHaveLength(1)
      expect(body.domain.records[0]?.value).not.toBe(oldRecordValue)

      const eventsRes = await withKey(
        app,
        apiKey.key,
        `/v1/domains/${domainId}/events`,
      )
      const eventsBody = (await eventsRes.json()) as {
        events: Array<{ type: string }>
      }
      expect(eventsBody.events.map((event) => event.type)).toEqual([
        'domain.claimed',
        'domain.challenge_regenerated',
      ])
    })

    it('rejects regenerating a verified domain, same rule the dashboard enforces', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey({ mode: 'test' })
      const { id: domainId } = await claimDomain(app, apiKey, 'verified.test')
      await withKey(app, apiKey.key, `/v1/domains/${domainId}/verify`, {
        method: 'POST',
      })

      const res = await withKey(
        app,
        apiKey.key,
        `/v1/domains/${domainId}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(409)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_status')
    })

    it('returns 404 for an unknown domain id', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()

      const res = await withKey(
        app,
        apiKey.key,
        `/v1/domains/${randomUUID()}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })

    it("404s (not 403) for another project's domain", async () => {
      const app = buildApp()
      const ownerKey = await createTestApiKey()
      const otherKey = await createTestApiKey()
      const { id: domainId } = await claimDomain(app, ownerKey, 'example.com')

      const res = await withKey(
        app,
        otherKey.key,
        `/v1/domains/${domainId}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
    })

    it("404s for the same project's key in the wrong mode", async () => {
      const app = buildApp()
      const liveKey = await createTestApiKey({ mode: 'live' })
      const testKey = await createTestApiKey({
        mode: 'test',
        projectId: liveKey.projectId,
        slug: liveKey.slug,
      })
      const { id: domainId } = await claimDomain(app, liveKey, 'example.com')

      const res = await withKey(
        app,
        testKey.key,
        `/v1/domains/${domainId}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
    })

    it('rejects unauthenticated requests', async () => {
      const app = buildApp()
      const res = await app.request(`/v1/domains/${randomUUID()}/regenerate`, {
        method: 'POST',
      })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /v1/domains/:id/events', () => {
    interface EventsResponseBody {
      events: Array<{ id: string; type: string; mode: string | null }>
      nextCursor: string | null
    }

    async function claimSandboxDomain(
      app: ReturnType<typeof buildApp>,
      apiKey: TestApiKey,
      domain: string,
    ): Promise<string> {
      const res = await withKey(app, apiKey.key, '/v1/domains', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const body = (await res.json()) as { domain: { id: string } }
      return body.domain.id
    }

    async function listEvents(
      app: ReturnType<typeof buildApp>,
      apiKey: TestApiKey,
      domainId: string,
      query = '',
    ): Promise<{ status: number; body: EventsResponseBody }> {
      const res = await withKey(
        app,
        apiKey.key,
        `/v1/domains/${domainId}/events${query}`,
      )
      return {
        status: res.status,
        body: (await res.json()) as EventsResponseBody,
      }
    }

    it('returns the claim + verify timeline in order', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey({ mode: 'test' })
      const domainId = await claimSandboxDomain(app, apiKey, 'verified.test')
      await withKey(app, apiKey.key, `/v1/domains/${domainId}/verify`, {
        method: 'POST',
      })

      const { status, body } = await listEvents(app, apiKey, domainId)
      expect(status).toBe(200)
      expect(body.events.map((event) => event.type)).toEqual([
        'domain.claimed',
        'domain.check_passed',
        'domain.verified',
      ])
      expect(body.events.every((event) => event.mode === 'test')).toBe(true)
      expect(body.nextCursor).toBeNull()
    })

    it('paginates with limit and cursor', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey({ mode: 'test' })
      const domainId = await claimSandboxDomain(app, apiKey, 'verified.test')
      await withKey(app, apiKey.key, `/v1/domains/${domainId}/verify`, {
        method: 'POST',
      })

      const firstPage = await listEvents(app, apiKey, domainId, '?limit=2')
      expect(firstPage.body.events).toHaveLength(2)
      expect(firstPage.body.nextCursor).not.toBeNull()

      const secondPage = await listEvents(
        app,
        apiKey,
        domainId,
        `?limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor ?? '')}`,
      )
      expect(secondPage.body.events).toHaveLength(1)
      expect(secondPage.body.events[0]?.type).toBe('domain.verified')
      expect(secondPage.body.nextCursor).toBeNull()
    })

    it('returns 404 for an unknown domain id', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()

      const { status } = await listEvents(app, apiKey, randomUUID())
      expect(status).toBe(404)
    })

    it("404s for another project's domain", async () => {
      const app = buildApp()
      const ownerKey = await createTestApiKey({ mode: 'test' })
      const otherKey = await createTestApiKey({ mode: 'test' })
      const domainId = await claimSandboxDomain(app, ownerKey, 'verified.test')

      const { status } = await listEvents(app, otherKey, domainId)
      expect(status).toBe(404)
    })

    it('rejects unauthenticated requests', async () => {
      const app = buildApp()
      const res = await app.request(`/v1/domains/${randomUUID()}/events`)
      expect(res.status).toBe(401)
    })
  })
})
