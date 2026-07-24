import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import type { SessionVerifier } from '@modules/accounts/ports'
import { deriveProjectSlug } from '@modules/projects/domain/brand'
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

// `projects.slug` carries a real unique constraint, and this file's real
// `/dashboard/projects` route derives it from `name` via `deriveProjectSlug`
// — a fixed literal like 'Skylane HR' would collide with this file's other
// tests (and other test files') own real project rows once run
// concurrently, same reasoning as `keyMaterial`-style helpers elsewhere.
function freshProjectName(base: string) {
  return `${base} ${randomUUID().slice(0, 8)}`
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
    const name = freshProjectName('Skylane HR')

    const createRes = await asUser(app, clerkUserId, '/dashboard/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    expect(createRes.status).toBe(201)

    const created = (await createRes.json()) as {
      project: { id: string; name: string; slug: string }
      keys: {
        test: { key: string; apiKey: { mode: string } }
        live: { key: string; apiKey: { mode: string } }
      }
    }
    expect(created.project.name).toBe(name)
    expect(created.project.slug).toBe(deriveProjectSlug(name))
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
      body: JSON.stringify({ name: freshProjectName('First') }),
    })
    await asUser(app, clerkUserId, '/dashboard/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: freshProjectName('Second') }),
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

describe('PATCH /dashboard/projects/:projectId', () => {
  afterEach(async () => {
    while (createdClerkUserIds.length > 0) {
      const clerkUserId = createdClerkUserIds.pop()
      if (clerkUserId) {
        await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
      }
    }
  })

  async function createProject(
    app: ReturnType<typeof buildApp>,
    clerkUserId: string,
    name: string,
  ) {
    const res = await asUser(app, clerkUserId, '/dashboard/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const body = (await res.json()) as {
      project: { id: string; name: string; slug: string }
    }
    return body.project
  }

  it('renames a project without changing its slug, reflected in a follow-up read', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const project = await createProject(
      app,
      clerkUserId,
      freshProjectName('Skylane HR'),
    )

    const patchRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${project.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Skylane People' }),
      },
    )
    expect(patchRes.status).toBe(200)
    const patched = (await patchRes.json()) as {
      project: { id: string; name: string; slug: string }
    }
    expect(patched.project.id).toBe(project.id)
    expect(patched.project.name).toBe('Skylane People')
    expect(patched.project.slug).toBe(project.slug)

    const listRes = await asUser(app, clerkUserId, '/dashboard/projects')
    const listBody = (await listRes.json()) as {
      projects: Array<{ id: string; name: string; slug: string }>
    }
    const reread = listBody.projects.find((p) => p.id === project.id)
    expect(reread?.name).toBe('Skylane People')
    expect(reread?.slug).toBe(project.slug)
  })

  it('rejects an empty name', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const project = await createProject(
      app,
      clerkUserId,
      freshProjectName('Skylane HR'),
    )

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${project.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('404s for an unknown project id', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${randomUUID()}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      },
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it("404s for a project belonging to a different account, and doesn't rename it", async () => {
    const app = buildApp()
    const owner = freshClerkUserId()
    const other = freshClerkUserId()
    const name = freshProjectName('Skylane HR')
    const project = await createProject(app, owner, name)

    const res = await asUser(app, other, `/dashboard/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Hijacked' }),
    })
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')

    const listRes = await asUser(app, owner, '/dashboard/projects')
    const listBody = (await listRes.json()) as {
      projects: Array<{ id: string; name: string }>
    }
    expect(listBody.projects.find((p) => p.id === project.id)?.name).toBe(name)
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

  it('backfills an account bootstrapped before its session carried an email, without re-sending the welcome email', async () => {
    const clerkUserId = freshClerkUserId()

    // Bootstraps with no email claim, like this repo's Clerk instance
    // today — matches the pre-fix accounts this backfill targets.
    const bootstrapApp = createApp({ db, sessionVerifier: fakeSessionVerifier })
    const first = await asUser(bootstrapApp, clerkUserId, '/dashboard/projects')
    expect(first.status).toBe(200)

    const [beforeBackfill] = await db
      .select({ email: accounts.email })
      .from(accounts)
      .where(eq(accounts.clerkUserId, clerkUserId))
    expect(beforeBackfill?.email).toBeNull()

    // Same user, now with an email claim — the Clerk instance was fixed.
    const sent: { to: string; subject: string }[] = []
    const backfillApp = createApp({
      db,
      sessionVerifier: fakeSessionVerifierWithEmail,
      emailSender: {
        async send(message) {
          sent.push(message)
        },
      },
    })
    const second = await asUser(backfillApp, clerkUserId, '/dashboard/projects')
    expect(second.status).toBe(200)

    const [afterBackfill] = await db
      .select({ email: accounts.email })
      .from(accounts)
      .where(eq(accounts.clerkUserId, clerkUserId))
    expect(afterBackfill?.email).toBe('builder@example.com')
    expect(sent).toHaveLength(0) // backfill isn't a create — no welcome email
  })
})
