import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_TOKEN_TTL_MS } from '@domainproof/core'
import { createApp } from '../../../app'
import type { SessionVerifier } from '@modules/accounts/ports'
import { createDb, type Database } from '@infra/db/client'
import { accounts, challenges, domains, events } from '@infra/db/schema'

// Auth here is a fake SessionVerifier implementing the port directly, same
// as `routes/keys.test.ts` — the real Clerk verifier's own behavior is
// covered by `infra/auth/clerk.test.ts`. This file is the only coverage of
// `/dashboard/projects/:projectId/domains` wiring end to end: route
// mounting, project ownership scoping, and pagination. The read tests below
// mostly insert test domains directly (like
// `modules/events/repository.test.ts`'s `createTestDomain`) since they only
// care about a domain already existing; the write tests exercise
// `createDomain` (this plane's own claim route) instead.
const db: Database = createDb(
  process.env.DATABASE_URL ??
    'postgres://domainproof:domainproof@localhost:5432/domainproof',
)
const createdClerkUserIds: string[] = []

const fakeSessionVerifier: SessionVerifier = {
  async verify(token) {
    if (!token.startsWith('token-for-')) {
      return { ok: false, reason: 'invalid_or_expired' }
    }
    return { ok: true, claims: { userId: token.slice('token-for-'.length) } }
  },
}

function freshClerkUserId() {
  const id = `user_${randomUUID()}`
  createdClerkUserIds.push(id)
  return id
}

function buildApp(overrides: { now?: () => Date } = {}) {
  return createApp({ db, sessionVerifier: fakeSessionVerifier, ...overrides })
}

async function asUser(
  app: ReturnType<typeof buildApp>,
  clerkUserId: string,
  path: string,
  init: RequestInit = {},
) {
  return app.request(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer token-for-${clerkUserId}`,
    },
  })
}

async function createProject(
  app: ReturnType<typeof buildApp>,
  clerkUserId: string,
  name = 'Test project',
): Promise<string> {
  const res = await asUser(app, clerkUserId, '/dashboard/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const body = (await res.json()) as { project: { id: string } }
  return body.project.id
}

async function createTestDomain(
  projectId: string,
  overrides: {
    domain?: string
    mode?: 'test' | 'live'
    externalId?: string
    withChallenge?: boolean
  } = {},
): Promise<string> {
  const domainName = overrides.domain ?? `example-${randomUUID()}.test`

  const [domain] = await db
    .insert(domains)
    .values({
      projectId,
      domain: domainName,
      mode: overrides.mode ?? 'live',
      externalId: overrides.externalId,
      status: 'pending',
      frontendToken: `frontend-token-${randomUUID()}`,
    })
    .returning({ id: domains.id })
  if (!domain) throw new Error('failed to create test domain')

  if (overrides.withChallenge !== false) {
    await db.insert(challenges).values({
      domainId: domain.id,
      method: 'dns_txt',
      token: `token-${randomUUID()}`,
      recordHost: `_challenge.${domainName}`,
      recordValue: `verify=${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60_000),
    })
  }

  return domain.id
}

interface DomainResponseBody {
  domain: {
    id: string
    domain: string
    mode: string
    status: string
    external_id: string | null
    verificationUrl: string
    records: Array<{
      type: string
      name: string
      value: string
      status: string
    }>
  }
}

/** Claims a domain through the write route under test, defaulting to test mode. */
async function createDomain(
  app: ReturnType<typeof buildApp>,
  clerkUserId: string,
  projectId: string,
  overrides: {
    domain: string
    mode?: 'test' | 'live'
    external_id?: string
  },
) {
  return asUser(app, clerkUserId, `/dashboard/projects/${projectId}/domains`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'test', ...overrides }),
  })
}

describe('/dashboard/projects/:projectId/domains', () => {
  afterEach(async () => {
    while (createdClerkUserIds.length > 0) {
      const clerkUserId = createdClerkUserIds.pop()
      if (clerkUserId) {
        await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
      }
    }
  })

  describe('GET /', () => {
    it('rejects unauthenticated requests', async () => {
      const app = buildApp()
      const res = await app.request('/dashboard/projects/anything/domains')
      expect(res.status).toBe(401)
    })

    it("404s for a project that doesn't exist", async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${randomUUID()}/domains`,
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })

    it("404s (not 403) for another account's project", async () => {
      const app = buildApp()
      const ownerId = freshClerkUserId()
      const otherId = freshClerkUserId()
      const projectId = await createProject(app, ownerId)

      const res = await asUser(
        app,
        otherId,
        `/dashboard/projects/${projectId}/domains`,
      )
      expect(res.status).toBe(404)
    })

    it('returns an empty list for a project with no domains', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        domains: unknown[]
        nextCursor: string | null
      }
      expect(body.domains).toEqual([])
      expect(body.nextCursor).toBeNull()
    })

    it('lists domains across both modes, newest first, with status/mode/method/timestamps', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      await createTestDomain(projectId, {
        domain: 'live.example.test',
        mode: 'live',
      })
      await createTestDomain(projectId, {
        domain: 'test.example.test',
        mode: 'test',
      })

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        domains: Array<{
          domain: string
          mode: string
          status: string
          method: string | null
          createdAt: string
          updatedAt: string
          verifiedAt: string | null
        }>
      }
      expect(body.domains.map((d) => d.domain)).toEqual([
        'test.example.test',
        'live.example.test',
      ])
      expect(body.domains.map((d) => d.mode)).toEqual(['test', 'live'])
      expect(body.domains.every((d) => d.status === 'pending')).toBe(true)
      expect(body.domains.every((d) => d.method === 'dns_txt')).toBe(true)
      expect(body.domains.every((d) => typeof d.createdAt === 'string')).toBe(
        true,
      )
      expect(body.domains.every((d) => d.verifiedAt === null)).toBe(true)
    })

    it("resolves each domain's provider — 'unknown' for a .test sandbox domain, since it has no real DNS to inspect", async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      await createTestDomain(projectId, { domain: 'sandbox.example.test' })

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        domains: Array<{ domain: string; provider: string }>
      }
      expect(body.domains).toHaveLength(1)
      expect(body.domains[0]?.provider).toBe('unknown')
    })

    it("only returns the requested project's domains", async () => {
      const app = buildApp()
      const ownerId = freshClerkUserId()
      const projectAId = await createProject(app, ownerId, 'Project A')
      const projectBId = await createProject(app, ownerId, 'Project B')

      await createTestDomain(projectAId, { domain: 'a.example.test' })
      await createTestDomain(projectBId, { domain: 'b.example.test' })

      const res = await asUser(
        app,
        ownerId,
        `/dashboard/projects/${projectAId}/domains`,
      )
      const body = (await res.json()) as { domains: Array<{ domain: string }> }
      expect(body.domains.map((d) => d.domain)).toEqual(['a.example.test'])
    })

    it('filters by external_id, matching every domain claimed under it', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      await createTestDomain(projectId, {
        domain: 'customer-a.test',
        externalId: 'customer_1',
      })
      await createTestDomain(projectId, {
        domain: 'customer-a-alt.test',
        externalId: 'customer_1',
      })
      await createTestDomain(projectId, {
        domain: 'customer-b.test',
        externalId: 'customer_2',
      })

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains?external_id=customer_1`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as { domains: Array<{ domain: string }> }
      expect(body.domains.map((d) => d.domain).sort()).toEqual([
        'customer-a-alt.test',
        'customer-a.test',
      ])
    })

    it('filters by mode, narrowing to test or live claims', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      await createTestDomain(projectId, {
        domain: 'live.example.test',
        mode: 'live',
      })
      await createTestDomain(projectId, {
        domain: 'test.example.test',
        mode: 'test',
      })

      const liveRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains?mode=live`,
      )
      expect(liveRes.status).toBe(200)
      const liveBody = (await liveRes.json()) as {
        domains: Array<{ domain: string }>
      }
      expect(liveBody.domains.map((d) => d.domain)).toEqual([
        'live.example.test',
      ])

      const testRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains?mode=test`,
      )
      expect(testRes.status).toBe(200)
      const testBody = (await testRes.json()) as {
        domains: Array<{ domain: string }>
      }
      expect(testBody.domains.map((d) => d.domain)).toEqual([
        'test.example.test',
      ])
    })

    it('combines mode with external_id and cursor', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      await createTestDomain(projectId, {
        domain: 'customer-live-1.test',
        mode: 'live',
        externalId: 'customer_1',
      })
      await createTestDomain(projectId, {
        domain: 'customer-live-2.test',
        mode: 'live',
        externalId: 'customer_1',
      })
      await createTestDomain(projectId, {
        domain: 'customer-test.test',
        mode: 'test',
        externalId: 'customer_1',
      })
      await createTestDomain(projectId, {
        domain: 'other-customer-live.test',
        mode: 'live',
        externalId: 'customer_2',
      })

      const firstRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains?mode=live&external_id=customer_1&limit=1`,
      )
      expect(firstRes.status).toBe(200)
      const firstBody = (await firstRes.json()) as {
        domains: Array<{ domain: string }>
        nextCursor: string | null
      }
      expect(firstBody.domains).toHaveLength(1)
      expect(firstBody.nextCursor).not.toBeNull()

      const secondRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains?mode=live&external_id=customer_1&limit=1&cursor=${encodeURIComponent(
          firstBody.nextCursor ?? '',
        )}`,
      )
      expect(secondRes.status).toBe(200)
      const secondBody = (await secondRes.json()) as {
        domains: Array<{ domain: string }>
        nextCursor: string | null
      }
      expect(secondBody.domains).toHaveLength(1)
      expect(secondBody.nextCursor).toBeNull()

      const allDomains = [...firstBody.domains, ...secondBody.domains].map(
        (d) => d.domain,
      )
      expect(allDomains.sort()).toEqual([
        'customer-live-1.test',
        'customer-live-2.test',
      ])
    })

    it('rejects an invalid mode', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains?mode=sandbox`,
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_request')
    })

    it('paginates with limit and cursor', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      for (let i = 0; i < 3; i += 1) {
        await createTestDomain(projectId, { domain: `example-${i}.test` })
      }

      const firstRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains?limit=2`,
      )
      const firstBody = (await firstRes.json()) as {
        domains: unknown[]
        nextCursor: string | null
      }
      expect(firstBody.domains).toHaveLength(2)
      expect(firstBody.nextCursor).not.toBeNull()

      const secondRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains?limit=2&cursor=${encodeURIComponent(
          firstBody.nextCursor ?? '',
        )}`,
      )
      const secondBody = (await secondRes.json()) as {
        domains: unknown[]
        nextCursor: string | null
      }
      expect(secondBody.domains).toHaveLength(1)
      expect(secondBody.nextCursor).toBeNull()
    })

    it('rejects an invalid limit', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains?limit=0`,
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_request')
    })
  })

  describe('GET /:domainId', () => {
    it('returns the domain with its current record instructions', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      const domainId = await createTestDomain(projectId, {
        domain: 'example.test',
      })

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${domainId}`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        domain: {
          id: string
          domain: string
          status: string
          records: Array<{
            type: string
            name: string
            value: string
            status: string
          }>
        }
      }
      expect(body.domain.id).toBe(domainId)
      expect(body.domain.domain).toBe('example.test')
      expect(body.domain.status).toBe('pending')
      expect(body.domain.records).toHaveLength(1)
      expect(body.domain.records[0]?.type).toBe('TXT')
      expect(body.domain.records[0]?.name).toBe('_challenge.example.test')
      expect(body.domain.records[0]?.status).toBe('pending')
    })

    it('404s for an unknown domain id', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${randomUUID()}`,
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })

    it("404s (not 403) for another project's domain", async () => {
      const app = buildApp()
      const ownerId = freshClerkUserId()
      const otherId = freshClerkUserId()
      const ownerProjectId = await createProject(app, ownerId)
      const otherProjectId = await createProject(app, otherId)
      const domainId = await createTestDomain(ownerProjectId)

      const res = await asUser(
        app,
        otherId,
        `/dashboard/projects/${otherProjectId}/domains/${domainId}`,
      )
      expect(res.status).toBe(404)
    })
  })

  describe('GET /:domainId/events', () => {
    it('returns the domain event timeline, oldest first, cursor-paginated', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      const domainId = await createTestDomain(projectId)

      await db.insert(events).values({
        type: 'domain.claimed',
        domainId,
        mode: 'live',
        payload: { domainId },
      })
      await db.insert(events).values({
        type: 'domain.check_passed',
        domainId,
        mode: 'live',
        payload: { domainId },
      })

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${domainId}/events`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        events: Array<{ type: string }>
        nextCursor: string | null
      }
      expect(body.events.map((e) => e.type)).toEqual([
        'domain.claimed',
        'domain.check_passed',
      ])
      expect(body.nextCursor).toBeNull()
    })

    it('returns an empty list for a domain with no events', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      const domainId = await createTestDomain(projectId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${domainId}/events`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        events: unknown[]
        nextCursor: string | null
      }
      expect(body.events).toEqual([])
      expect(body.nextCursor).toBeNull()
    })

    it("404s (not 403) for another project's domain, without touching the events module", async () => {
      const app = buildApp()
      const ownerId = freshClerkUserId()
      const otherId = freshClerkUserId()
      const ownerProjectId = await createProject(app, ownerId)
      const otherProjectId = await createProject(app, otherId)
      const domainId = await createTestDomain(ownerProjectId)

      const res = await asUser(
        app,
        otherId,
        `/dashboard/projects/${otherProjectId}/domains/${domainId}/events`,
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })
  })

  describe('POST /', () => {
    it('rejects unauthenticated requests', async () => {
      const app = buildApp()
      const res = await app.request('/dashboard/projects/anything/domains', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain: 'example.test', mode: 'test' }),
      })
      expect(res.status).toBe(401)
    })

    it('claims a domain with a TXT record and a hosted verification URL', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await createDomain(app, clerkUserId, projectId, {
        domain: 'example.test',
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as DomainResponseBody
      expect(body.domain.domain).toBe('example.test')
      expect(body.domain.mode).toBe('test')
      expect(body.domain.status).toBe('pending')
      // Embeds the domain's Frontend API token, not its internal id — see
      // `infra/db/schema.ts`'s `frontendToken` doc comment for why the two
      // are deliberately different values.
      expect(body.domain.verificationUrl).toMatch(
        /^https:\/\/domainproof\.dev\/verify\/[a-z2-7]{26}$/,
      )
      expect(body.domain.verificationUrl).not.toContain(body.domain.id)
      expect(body.domain.records).toHaveLength(1)
      expect(body.domain.records[0]?.type).toBe('TXT')
      expect(body.domain.records[0]?.status).toBe('pending')
    })

    it('claims a domain with an external_id and returns it on every response', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await createDomain(app, clerkUserId, projectId, {
        domain: 'example.test',
        external_id: 'customer_1',
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as DomainResponseBody
      expect(body.domain.external_id).toBe('customer_1')
    })

    it('claims a domain without an external_id, which defaults to null', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await createDomain(app, clerkUserId, projectId, {
        domain: 'example.test',
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as DomainResponseBody
      expect(body.domain.external_id).toBeNull()
    })

    it('rejects an external_id over 256 characters', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await createDomain(app, clerkUserId, projectId, {
        domain: 'example.test',
        external_id: 'a'.repeat(257),
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_request')
    })

    it('rejects a request body missing mode', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ domain: 'example.test' }),
        },
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_request')
    })

    it('rejects a domain that is not a valid hostname', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await createDomain(app, clerkUserId, projectId, {
        domain: 'not a hostname',
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_request')
    })

    it('rejects a .test sandbox domain claimed in live mode', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await createDomain(app, clerkUserId, projectId, {
        domain: 'example.test',
        mode: 'live',
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('sandbox_requires_test_mode')
    })

    it('returns 409 for a duplicate (project, domain, mode) claim', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      await createDomain(app, clerkUserId, projectId, { domain: 'dup.test' })
      const res = await createDomain(app, clerkUserId, projectId, {
        domain: 'dup.test',
      })
      expect(res.status).toBe(409)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('domain_already_claimed')
    })

    it('allows the same domain to be claimed again under a different project', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectAId = await createProject(app, clerkUserId, 'Project A')
      const projectBId = await createProject(app, clerkUserId, 'Project B')

      await createDomain(app, clerkUserId, projectAId, {
        domain: 'shared.test',
      })
      const res = await createDomain(app, clerkUserId, projectBId, {
        domain: 'shared.test',
      })
      expect(res.status).toBe(201)
    })

    it("404s (not 403) for another account's project", async () => {
      const app = buildApp()
      const ownerId = freshClerkUserId()
      const otherId = freshClerkUserId()
      const projectId = await createProject(app, ownerId)

      const res = await createDomain(app, otherId, projectId, {
        domain: 'example.test',
      })
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })
  })

  describe('POST /:domainId/verify', () => {
    it('rejects unauthenticated requests', async () => {
      const app = buildApp()
      const res = await app.request(
        `/dashboard/projects/anything/domains/${randomUUID()}/verify`,
        { method: 'POST' },
      )
      expect(res.status).toBe(401)
    })

    it("verifies a 'verified.test' sandbox domain immediately", async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      const createRes = await createDomain(app, clerkUserId, projectId, {
        domain: 'verified.test',
      })
      const { domain: created } = (await createRes.json()) as DomainResponseBody

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${created.id}/verify`,
        { method: 'POST' },
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        domain: { status: string; records: Array<{ status: string }> }
        check: { outcome: string; checkedAt: string; explanation?: string }
      }
      expect(body.check.outcome).toBe('found')
      expect(body.check.explanation).toBeUndefined()
      expect(body.domain.status).toBe('verified')
      expect(body.domain.records[0]?.status).toBe('verified')
    })

    it("returns the expected/detected mismatch for a 'wrong-value.test' sandbox domain", async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      const createRes = await createDomain(app, clerkUserId, projectId, {
        domain: 'wrong-value.test',
      })
      const { domain: created } = (await createRes.json()) as DomainResponseBody

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${created.id}/verify`,
        { method: 'POST' },
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        domain: { status: string }
        check: {
          outcome: string
          expected?: string
          detected?: string[]
        }
      }
      expect(body.check.outcome).toBe('wrong_value')
      expect(typeof body.check.expected).toBe('string')
      expect(body.check.detected).toEqual(
        expect.arrayContaining([expect.any(String)]),
      )
      expect(body.domain.status).toBe('failed')
    })

    it('returns 404 for an unknown domain id', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${randomUUID()}/verify`,
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })

    it("404s (not 403) for another project's domain", async () => {
      const app = buildApp()
      const ownerId = freshClerkUserId()
      const otherId = freshClerkUserId()
      const ownerProjectId = await createProject(app, ownerId)
      const otherProjectId = await createProject(app, otherId)
      const domainId = await createTestDomain(ownerProjectId)

      const res = await asUser(
        app,
        otherId,
        `/dashboard/projects/${otherProjectId}/domains/${domainId}/verify`,
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
    })
  })

  describe('POST /:domainId/regenerate', () => {
    it('rejects unauthenticated requests', async () => {
      const app = buildApp()
      const res = await app.request(
        `/dashboard/projects/anything/domains/${randomUUID()}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(401)
    })

    it('issues a fresh challenge for a failed domain and moves it back to pending', async () => {
      let clockOffsetMs = 0
      const app = buildApp({ now: () => new Date(Date.now() + clockOffsetMs) })
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      // `nxdomain.test` never resolves, so pushing the clock past the
      // verification window hard-fails it without a real DNS dependency.
      const createRes = await createDomain(app, clerkUserId, projectId, {
        domain: 'nxdomain.test',
      })
      const { domain: created } = (await createRes.json()) as DomainResponseBody
      const oldRecordValue = created.records[0]?.value

      clockOffsetMs = DEFAULT_TOKEN_TTL_MS
      const verifyRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${created.id}/verify`,
        { method: 'POST' },
      )
      const verifyBody = (await verifyRes.json()) as DomainResponseBody
      expect(verifyBody.domain.status).toBe('failed')

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${created.id}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as DomainResponseBody
      expect(body.domain.status).toBe('pending')
      expect(body.domain.records).toHaveLength(1)
      expect(body.domain.records[0]?.value).not.toBe(oldRecordValue)
    })

    it('rejects regenerating a verified domain', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      const createRes = await createDomain(app, clerkUserId, projectId, {
        domain: 'verified.test',
      })
      const { domain: created } = (await createRes.json()) as DomainResponseBody
      await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${created.id}/verify`,
        { method: 'POST' },
      )

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${created.id}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(409)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_status')
    })

    it('returns 404 for an unknown domain id', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${randomUUID()}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })

    it("404s (not 403) for another project's domain", async () => {
      const app = buildApp()
      const ownerId = freshClerkUserId()
      const otherId = freshClerkUserId()
      const ownerProjectId = await createProject(app, ownerId)
      const otherProjectId = await createProject(app, otherId)
      const domainId = await createTestDomain(ownerProjectId, {
        mode: 'test',
      })

      const res = await asUser(
        app,
        otherId,
        `/dashboard/projects/${otherProjectId}/domains/${domainId}/regenerate`,
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /:domainId', () => {
    it('rejects unauthenticated requests', async () => {
      const app = buildApp()
      const res = await app.request(
        `/dashboard/projects/anything/domains/${randomUUID()}`,
        { method: 'DELETE' },
      )
      expect(res.status).toBe(401)
    })

    it('releases a domain, and it is gone afterward', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      const createRes = await createDomain(app, clerkUserId, projectId, {
        domain: 'example.test',
      })
      const { domain: created } = (await createRes.json()) as DomainResponseBody

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${created.id}`,
        { method: 'DELETE' },
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as DomainResponseBody
      expect(body.domain.id).toBe(created.id)

      const getRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${created.id}`,
      )
      expect(getRes.status).toBe(404)
    })

    it('returns 404 for an unknown domain id', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/domains/${randomUUID()}`,
        { method: 'DELETE' },
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })

    it("404s (not 403) for another project's domain", async () => {
      const app = buildApp()
      const ownerId = freshClerkUserId()
      const otherId = freshClerkUserId()
      const ownerProjectId = await createProject(app, ownerId)
      const otherProjectId = await createProject(app, otherId)
      const domainId = await createTestDomain(ownerProjectId)

      const res = await asUser(
        app,
        otherId,
        `/dashboard/projects/${otherProjectId}/domains/${domainId}`,
        { method: 'DELETE' },
      )
      expect(res.status).toBe(404)
    })
  })

  it('runs the full create -> verify -> regenerate -> delete journey, with every step visible on the event timeline', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const projectId = await createProject(app, clerkUserId)

    const createRes = await createDomain(app, clerkUserId, projectId, {
      domain: 'wrong-value.test',
    })
    expect(createRes.status).toBe(201)
    const { domain: created } = (await createRes.json()) as DomainResponseBody

    const verifyRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/domains/${created.id}/verify`,
      { method: 'POST' },
    )
    expect(verifyRes.status).toBe(200)
    const verifyBody = (await verifyRes.json()) as DomainResponseBody
    // pending -> failed: a wrong-but-valid-looking record is an actionable
    // mismatch, not "still propagating".
    expect(verifyBody.domain.status).toBe('failed')

    const regenerateRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/domains/${created.id}/regenerate`,
      { method: 'POST' },
    )
    expect(regenerateRes.status).toBe(200)
    const regenerateBody = (await regenerateRes.json()) as DomainResponseBody
    expect(regenerateBody.domain.status).toBe('pending')

    const eventsRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/domains/${created.id}/events`,
    )
    expect(eventsRes.status).toBe(200)
    const eventsBody = (await eventsRes.json()) as {
      events: Array<{ type: string }>
    }
    expect(eventsBody.events.map((e) => e.type)).toEqual([
      'domain.claimed',
      'domain.check_failed',
      'domain.failed',
      'domain.challenge_regenerated',
    ])

    const deleteRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/domains/${created.id}`,
      { method: 'DELETE' },
    )
    expect(deleteRes.status).toBe(200)

    const getRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/domains/${created.id}`,
    )
    expect(getRes.status).toBe(404)
  })
})
