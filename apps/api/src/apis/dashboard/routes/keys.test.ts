import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import type { SessionVerifier } from '@modules/accounts/ports'
import { createDb, type Database } from '@infra/db/client'
import { accounts } from '@infra/db/schema'

// Auth here is a fake SessionVerifier implementing the port directly,
// mapping "token-for-<userId>" straight to that user id — the real Clerk
// verifier's own behavior is covered by infra/auth/clerk.test.ts. This file
// is the only coverage of /dashboard/projects/:projectId/keys wiring end to
// end (route mounting, project ownership scoping, cross-account scoping),
// not of session verification itself.
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

describe('/dashboard/projects/:projectId/keys', () => {
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
    const res = await app.request('/dashboard/projects/anything/keys')
    expect(res.status).toBe(401)
  })

  it("404s for a project that doesn't exist", async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${randomUUID()}/keys`,
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
      `/dashboard/projects/${projectId}/keys`,
    )
    expect(res.status).toBe(404)
  })

  it('creates, lists, and never returns secret material', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const projectId = await createProject(app, clerkUserId)

    const createRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'live', name: 'Production' }),
      },
    )
    expect(createRes.status).toBe(201)

    const created = (await createRes.json()) as {
      key: string
      apiKey: { keyId: string; name: string | null }
    }
    expect(created.key).toMatch(/^dp_live_[a-z2-7]{12}_[a-z2-7]{26}$/)
    expect(created.apiKey.name).toBe('Production')

    const listRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/keys`,
    )
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as {
      apiKeys: Array<Record<string, unknown>>
    }
    // The project's bootstrap test+live pair, plus the one just created.
    expect(listBody.apiKeys).toHaveLength(3)

    const serialized = JSON.stringify(listBody)
    expect(serialized).not.toContain('secretHash')
    expect(serialized).not.toContain(created.key)
    // No 26-char base32 secret substring anywhere in the list response.
    expect(serialized).not.toMatch(/[a-z2-7]{26}/)
  })

  it('rejects a malformed create body', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const projectId = await createProject(app, clerkUserId)

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'not-a-mode' }),
      },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('revokes a key', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const projectId = await createProject(app, clerkUserId)

    const createRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'test' }),
      },
    )
    const created = (await createRes.json()) as { apiKey: { keyId: string } }

    const revokeRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/keys/${created.apiKey.keyId}/revoke`,
      { method: 'POST' },
    )
    expect(revokeRes.status).toBe(200)
    const revoked = (await revokeRes.json()) as {
      apiKey: { revokedAt: string | null }
    }
    expect(revoked.apiKey.revokedAt).not.toBeNull()
  })

  it('rotates a key: old dead, new works, same name', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const projectId = await createProject(app, clerkUserId)

    const createRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'live', name: 'Rotate target' }),
      },
    )
    const created = (await createRes.json()) as {
      key: string
      apiKey: { keyId: string; name: string | null }
    }

    const rotateRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/keys/${created.apiKey.keyId}/rotate`,
      { method: 'POST' },
    )
    expect(rotateRes.status).toBe(200)
    const rotated = (await rotateRes.json()) as {
      key: string
      apiKey: { keyId: string; name: string | null }
    }

    expect(rotated.apiKey.name).toBe('Rotate target')
    expect(rotated.apiKey.keyId).not.toBe(created.apiKey.keyId)

    const listRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/keys`,
    )
    const listBody = (await listRes.json()) as {
      apiKeys: Array<{ keyId: string; revokedAt: string | null }>
    }
    const oldEntry = listBody.apiKeys.find(
      (k) => k.keyId === created.apiKey.keyId,
    )
    const newEntry = listBody.apiKeys.find(
      (k) => k.keyId === rotated.apiKey.keyId,
    )
    expect(oldEntry?.revokedAt).not.toBeNull()
    expect(newEntry?.revokedAt).toBeNull()
  })

  it("404s (not 403) when acting on another account's key, via that account's own project", async () => {
    const app = buildApp()
    const ownerId = freshClerkUserId()
    const otherId = freshClerkUserId()

    const ownerProjectId = await createProject(app, ownerId)
    const otherProjectId = await createProject(app, otherId)

    const createRes = await asUser(
      app,
      ownerId,
      `/dashboard/projects/${ownerProjectId}/keys`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'test' }),
      },
    )
    const created = (await createRes.json()) as { apiKey: { keyId: string } }

    // otherId owns a project, but not ownerId's — the keyId 404s under
    // otherId's own project, same as an unknown keyId would.
    const revokeAsOther = await asUser(
      app,
      otherId,
      `/dashboard/projects/${otherProjectId}/keys/${created.apiKey.keyId}/revoke`,
      { method: 'POST' },
    )
    expect(revokeAsOther.status).toBe(404)
    const body = (await revokeAsOther.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')

    // And it's untouched from the owner's perspective.
    const listRes = await asUser(
      app,
      ownerId,
      `/dashboard/projects/${ownerProjectId}/keys`,
    )
    const listBody = (await listRes.json()) as {
      apiKeys: Array<{ keyId: string; revokedAt: string | null }>
    }
    expect(
      listBody.apiKeys.find((k) => k.keyId === created.apiKey.keyId)?.revokedAt,
    ).toBeNull()
  })

  it('returns 404 for an unknown key id', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const projectId = await createProject(app, clerkUserId)

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/keys/doesnotexist1/revoke`,
      { method: 'POST' },
    )
    expect(res.status).toBe(404)
  })
})
