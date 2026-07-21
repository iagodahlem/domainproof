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
// is the only coverage of /dashboard/projects wiring end to end (route
// mounting, account bootstrap, atomic key minting), not of session
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

describe('/dashboard/projects', () => {
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
    const res = await app.request('/dashboard/projects')
    expect(res.status).toBe(401)
  })

  it('lists no projects for a fresh account', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()

    const res = await asUser(app, clerkUserId, '/dashboard/projects')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { projects: unknown[] }
    expect(body.projects).toEqual([])
  })

  it('creates a project, minting both a test and a live key in one response, then lists it', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()

    const createRes = await asUser(app, clerkUserId, '/dashboard/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Skylane HR' }),
    })
    expect(createRes.status).toBe(201)

    const created = (await createRes.json()) as {
      project: { id: string; name: string; slug: string }
      keys: {
        test: { key: string; apiKey: { mode: string } }
        live: { key: string; apiKey: { mode: string } }
      }
    }
    expect(created.project.name).toBe('Skylane HR')
    expect(created.project.slug).toBe('skylane-hr')
    expect(created.keys.test.key).toMatch(/^dp_test_[a-z2-7]{12}_[a-z2-7]{26}$/)
    expect(created.keys.live.key).toMatch(/^dp_live_[a-z2-7]{12}_[a-z2-7]{26}$/)
    expect(created.keys.test.apiKey.mode).toBe('test')
    expect(created.keys.live.apiKey.mode).toBe('live')

    const serialized = JSON.stringify(created)
    expect(serialized).not.toContain('secretHash')

    const listRes = await asUser(app, clerkUserId, '/dashboard/projects')
    const listBody = (await listRes.json()) as {
      projects: Array<{ id: string; name: string; slug: string }>
    }
    expect(listBody.projects).toHaveLength(1)
    expect(listBody.projects[0]?.id).toBe(created.project.id)

    // The one-time keys are never carried on the list response.
    expect(JSON.stringify(listBody)).not.toContain(created.keys.test.key)
    expect(JSON.stringify(listBody)).not.toContain(created.keys.live.key)
  })

  it('allows creating more than one project for the same account', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()

    await asUser(app, clerkUserId, '/dashboard/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'First' }),
    })
    await asUser(app, clerkUserId, '/dashboard/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Second' }),
    })

    const listRes = await asUser(app, clerkUserId, '/dashboard/projects')
    const listBody = (await listRes.json()) as { projects: unknown[] }
    expect(listBody.projects).toHaveLength(2)
  })

  it('rejects an empty project name', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()

    const res = await asUser(app, clerkUserId, '/dashboard/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('rejects a missing request body', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()

    const res = await asUser(app, clerkUserId, '/dashboard/projects', {
      method: 'POST',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })
})

describe('account bootstrap notifications', () => {
  // A session claims email — the fake sessionVerifier above never sets one
  // (matching this repo's real Clerk wiring, see
  // modules/accounts/service.ts), so this variant proves the email, once
  // present, actually flows through to the welcome email.
  const fakeSessionVerifierWithEmail: SessionVerifier = {
    async verify(token) {
      if (!token.startsWith('token-for-')) {
        return { ok: false, reason: 'invalid_or_expired' }
      }
      return {
        ok: true,
        claims: {
          userId: token.slice('token-for-'.length),
          email: 'builder@example.com',
        },
      }
    },
  }

  afterEach(async () => {
    while (createdClerkUserIds.length > 0) {
      const clerkUserId = createdClerkUserIds.pop()
      if (clerkUserId) {
        await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
      }
    }
  })

  it("sends a welcome email to the session's email on first bootstrap, never again after", async () => {
    const sent: { to: string; subject: string }[] = []
    const app = createApp({
      db,
      sessionVerifier: fakeSessionVerifierWithEmail,
      emailSender: {
        async send(message) {
          sent.push(message)
        },
      },
    })
    const clerkUserId = freshClerkUserId()

    const first = await asUser(app, clerkUserId, '/dashboard/projects')
    expect(first.status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      to: 'builder@example.com',
      subject: 'Welcome to DomainProof',
    })

    const second = await asUser(app, clerkUserId, '/dashboard/projects')
    expect(second.status).toBe(200)
    expect(sent).toHaveLength(1) // no second welcome email on a later request
  })

  it('never sends an email when RESEND_API_KEY (here: no emailSender) is not configured', async () => {
    const app = createApp({ db, sessionVerifier: fakeSessionVerifierWithEmail })
    const clerkUserId = freshClerkUserId()

    // No emailSender injected and no RESEND_API_KEY in this test env, so
    // the notification subscribers are never registered — this proves the
    // request path still succeeds rather than crashing.
    const res = await asUser(app, clerkUserId, '/dashboard/projects')
    expect(res.status).toBe(200)
  })
})
