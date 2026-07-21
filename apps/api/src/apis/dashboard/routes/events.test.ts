import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import type { SessionVerifier } from '@modules/accounts/ports'
import { createDb, type Database } from '@infra/db/client'
import { accounts, domains, events } from '@infra/db/schema'

// Same fake-auth/db-fixture approach as `routes/domains.test.ts` — this
// file is the only coverage of `/dashboard/projects/:projectId/events`
// wiring end to end: route mounting, project ownership scoping, and
// pagination across multiple domains. Test domains/events are inserted
// directly (like `modules/events/repository.test.ts`'s helpers), since
// these tests only care about events already existing.
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
  overrides: { domain?: string; mode?: 'test' | 'live' } = {},
): Promise<string> {
  const [domain] = await db
    .insert(domains)
    .values({
      projectId,
      domain: overrides.domain ?? `example-${randomUUID()}.test`,
      mode: overrides.mode ?? 'live',
      status: 'pending',
      frontendToken: `frontend-token-${randomUUID()}`,
    })
    .returning({ id: domains.id })
  if (!domain) throw new Error('failed to create test domain')

  return domain.id
}

async function insertEvent(
  domainId: string,
  type: string,
  mode: 'test' | 'live' = 'live',
) {
  await db.insert(events).values({
    type,
    domainId,
    mode,
    payload: { domainId },
  })
}

describe('/dashboard/projects/:projectId/events', () => {
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
      const res = await app.request('/dashboard/projects/anything/events')
      expect(res.status).toBe(401)
    })

    it("404s for a project that doesn't exist", async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${randomUUID()}/events`,
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
        `/dashboard/projects/${projectId}/events`,
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })

    it('returns an empty list for a project with no domains', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/events`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        events: unknown[]
        nextCursor: string | null
      }
      expect(body.events).toEqual([])
      expect(body.nextCursor).toBeNull()
    })

    it('returns an empty list for a project whose domains have no events', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      await createTestDomain(projectId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/events`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        events: unknown[]
        nextCursor: string | null
      }
      expect(body.events).toEqual([])
      expect(body.nextCursor).toBeNull()
    })

    it('lists events from several domains interleaved, newest first, with domain/mode columns', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      const domainA = await createTestDomain(projectId, {
        domain: 'a.example.test',
        mode: 'live',
      })
      const domainB = await createTestDomain(projectId, {
        domain: 'b.example.test',
        mode: 'test',
      })

      await insertEvent(domainA, 'domain.claimed', 'live')
      await insertEvent(domainB, 'domain.claimed', 'test')
      await insertEvent(domainA, 'domain.verified', 'live')

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/events`,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        events: Array<{
          type: string
          domain: string
          mode: string
          createdAt: string
        }>
        nextCursor: string | null
      }
      expect(body.events.map((e) => e.type)).toEqual([
        'domain.verified',
        'domain.claimed',
        'domain.claimed',
      ])
      expect(body.events.map((e) => e.domain)).toEqual([
        'a.example.test',
        'b.example.test',
        'a.example.test',
      ])
      expect(body.events.map((e) => e.mode)).toEqual(['live', 'test', 'live'])
      expect(body.nextCursor).toBeNull()
    })

    it("only returns the requested project's events", async () => {
      const app = buildApp()
      const ownerId = freshClerkUserId()
      const projectAId = await createProject(app, ownerId, 'Project A')
      const projectBId = await createProject(app, ownerId, 'Project B')
      const domainA = await createTestDomain(projectAId, {
        domain: 'a.example.test',
      })
      const domainB = await createTestDomain(projectBId, {
        domain: 'b.example.test',
      })

      await insertEvent(domainA, 'domain.claimed')
      await insertEvent(domainB, 'domain.claimed')

      const res = await asUser(
        app,
        ownerId,
        `/dashboard/projects/${projectAId}/events`,
      )
      const body = (await res.json()) as {
        events: Array<{ domain: string }>
      }
      expect(body.events.map((e) => e.domain)).toEqual(['a.example.test'])
    })

    it('paginates with limit and cursor across a page boundary', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)
      const domainId = await createTestDomain(projectId)

      for (let i = 0; i < 3; i += 1) {
        await insertEvent(domainId, 'domain.check_passed')
      }

      const firstRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/events?limit=2`,
      )
      const firstBody = (await firstRes.json()) as {
        events: unknown[]
        nextCursor: string | null
      }
      expect(firstBody.events).toHaveLength(2)
      expect(firstBody.nextCursor).not.toBeNull()

      const secondRes = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/events?limit=2&cursor=${encodeURIComponent(
          firstBody.nextCursor ?? '',
        )}`,
      )
      const secondBody = (await secondRes.json()) as {
        events: unknown[]
        nextCursor: string | null
      }
      expect(secondBody.events).toHaveLength(1)
      expect(secondBody.nextCursor).toBeNull()
    })

    it('rejects an invalid limit', async () => {
      const app = buildApp()
      const clerkUserId = freshClerkUserId()
      const projectId = await createProject(app, clerkUserId)

      const res = await asUser(
        app,
        clerkUserId,
        `/dashboard/projects/${projectId}/events?limit=0`,
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_request')
    })
  })
})
