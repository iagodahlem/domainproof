import { createHash, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { generateToken } from '@domainproof/core'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import { createDb, type Database } from '@infra/db/client'
import { accounts, apiKeys, projects } from '@infra/db/schema'
import { generateKeyId } from '@modules/keys/domain/encoding'

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

function buildApp() {
  return createApp({ db })
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
        verification_url: string
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
    expect(body.domain.verification_url).toBe(
      `https://domainproof.dev/verify/${body.domain.id}`,
    )

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

  it('returns 404 when releasing an unknown domain id', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await withKey(app, apiKey.key, `/v1/domains/${randomUUID()}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(404)
  })
})
