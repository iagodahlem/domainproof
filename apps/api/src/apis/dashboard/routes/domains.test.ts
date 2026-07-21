import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import type { SessionVerifier } from '@modules/accounts/ports'
import { createDb, type Database } from '@infra/db/client'
import { accounts, challenges, domains, events } from '@infra/db/schema'

// Auth here is a fake SessionVerifier implementing the port directly, same
// as `routes/keys.test.ts` — the real Clerk verifier's own behavior is
// covered by `infra/auth/clerk.test.ts`. This file is the only coverage of
// `/dashboard/projects/:projectId/domains` wiring end to end: route
// mounting, project ownership scoping, and pagination. There's no dashboard
// write path to claim a domain through, so test domains are inserted
// directly (like `modules/events/repository.test.ts`'s `createTestDomain`).
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

function buildApp() {
  return createApp({ db, sessionVerifier: fakeSessionVerifier })
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
      status: 'pending',
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
})
