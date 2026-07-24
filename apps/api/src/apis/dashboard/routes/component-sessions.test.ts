import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import type { SessionVerifier } from '@modules/accounts/ports'
import { createDb, type Database } from '@infra/db/client'
import { accounts } from '@infra/db/schema'

// Same fake-verifier pattern as keys.test.ts — this file is the coverage
// of /dashboard/projects/:projectId/component-sessions wiring end to end
// (route mounting, project ownership scoping), not of session
// verification itself.
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

describe('/dashboard/projects/:projectId/component-sessions', () => {
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
    const res = await app.request(
      '/dashboard/projects/anything/component-sessions',
      { method: 'POST' },
    )
    expect(res.status).toBe(401)
  })

  it("404s for a project that doesn't exist", async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${randomUUID()}/component-sessions`,
      { method: 'POST' },
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
      `/dashboard/projects/${projectId}/component-sessions`,
      { method: 'POST' },
    )
    expect(res.status).toBe(404)
  })

  it('mints a test-mode session token', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const projectId = await createProject(app, clerkUserId)

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/component-sessions`,
      { method: 'POST' },
    )
    expect(res.status).toBe(201)

    const body = (await res.json()) as {
      sessionToken: string
      expiresAt: string
    }
    expect(body.sessionToken.length).toBeGreaterThan(0)
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })
})
