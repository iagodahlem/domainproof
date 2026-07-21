import { createHash, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { generateToken } from '@domainproof/core'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import { createDb, type Database } from '@infra/db/client'
import {
  accounts,
  apiKeys,
  componentSessions,
  domains,
  projects,
} from '@infra/db/schema'
import { generateKeyId } from '@modules/keys/domain/encoding'

/**
 * End-to-end coverage of the full component-session journey: mint via
 * the real `/v1/component-sessions` wiring, spend it via
 * `/frontend/component-sessions/:sessionToken/claim`, and confirm the
 * resulting claim's own `frontendToken` works on the standard
 * `/frontend/verifications/:token` routes (already covered in isolation
 * by `verifications.test.ts`) — against a real db throughout.
 */
const db: Database = createDb(
  process.env.DATABASE_URL ??
    'postgres://domainproof:domainproof@localhost:5432/domainproof',
)
const createdClerkUserIds: string[] = []

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

async function createTestApiKey(
  overrides: { mode?: 'test' | 'live'; projectName?: string } = {},
): Promise<{ projectId: string; key: string }> {
  const mode = overrides.mode ?? 'test'
  const clerkUserId = `user_${randomUUID()}`
  createdClerkUserIds.push(clerkUserId)

  const [account] = await db
    .insert(accounts)
    .values({ clerkUserId })
    .returning({ id: accounts.id })
  if (!account) throw new Error('failed to create test account')

  const [project] = await db
    .insert(projects)
    .values({
      accountId: account.id,
      name: overrides.projectName ?? 'Component Session Test',
      slug: 'cst',
    })
    .returning({ id: projects.id })
  if (!project) throw new Error('failed to create test project')

  const keyId = generateKeyId()
  const secret = generateToken()
  await db.insert(apiKeys).values({
    projectId: project.id,
    mode,
    keyId,
    secretHash: hashSecret(secret),
    last4: secret.slice(-4),
    name: null,
  })

  return { projectId: project.id, key: `dp_${mode}_${keyId}_${secret}` }
}

function buildApp() {
  return createApp({ db })
}

async function mintSession(
  app: ReturnType<typeof buildApp>,
  key: string,
  body: { externalId?: string } = {},
): Promise<string> {
  const res = await app.request('/v1/component-sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(201)
  const responseBody = (await res.json()) as { sessionToken: string }
  return responseBody.sessionToken
}

async function claimViaSession(
  app: ReturnType<typeof buildApp>,
  sessionToken: string,
  domain: string,
) {
  return app.request(`/frontend/component-sessions/${sessionToken}/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain }),
  })
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop()
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
    }
  }
})

describe('POST /frontend/component-sessions/:sessionToken/claim', () => {
  it('claims a domain through the standard claim path and returns the verification payload plus a frontendToken', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const sessionToken = await mintSession(app, apiKey.key)

    const res = await claimViaSession(
      app,
      sessionToken,
      'component-example.test',
    )
    expect(res.status).toBe(201)

    const body = (await res.json()) as {
      domain: string
      mode: string
      status: string
      projectName: string
      records: Array<{ label: string; type: string; value: string }>
      check: unknown
      updatedAt: string
      frontendToken: string
    }
    expect(body.domain).toBe('component-example.test')
    expect(body.mode).toBe('test')
    expect(body.status).toBe('pending')
    expect(body.projectName).toBe('Component Session Test')
    expect(body.check).toBeNull()
    expect(typeof body.frontendToken).toBe('string')
    expect(body.records).toHaveLength(1)

    // The claim's own frontendToken works on the standard verification
    // endpoints from here on — the component switches over, same as any
    // other claim.
    const verifyRes = await app.request(
      `/frontend/verifications/${body.frontendToken}`,
    )
    expect(verifyRes.status).toBe(200)
    const verifyBody = (await verifyRes.json()) as { domain: string }
    expect(verifyBody.domain).toBe('component-example.test')
  })

  it("stamps the session's externalId onto the created domain claim", async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const sessionToken = await mintSession(app, apiKey.key, {
      externalId: 'user_55',
    })

    const res = await claimViaSession(
      app,
      sessionToken,
      'attributed-example.test',
    )
    expect(res.status).toBe(201)

    const [row] = await db
      .select()
      .from(domains)
      .where(eq(domains.domain, 'attributed-example.test'))
    expect(row?.externalId).toBe('user_55')
  })

  it('rejects a second claim attempt on the same, now-consumed session', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const sessionToken = await mintSession(app, apiKey.key)

    const first = await claimViaSession(app, sessionToken, 'first-claim.test')
    expect(first.status).toBe(201)

    const second = await claimViaSession(app, sessionToken, 'second-claim.test')
    expect(second.status).toBe(404)
    const body = (await second.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')

    // The second attempt's domain was never created.
    const rows = await db
      .select()
      .from(domains)
      .where(eq(domains.domain, 'second-claim.test'))
    expect(rows).toHaveLength(0)
  })

  it('rejects an expired session', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const sessionToken = await mintSession(app, apiKey.key)

    await db
      .update(componentSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(componentSessions.token, sessionToken))

    const res = await claimViaSession(app, sessionToken, 'expired-example.test')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it('rejects an unknown session token', async () => {
    const app = buildApp()

    const res = await claimViaSession(
      app,
      `unknown-session-${randomUUID()}`,
      'unknown-session-example.test',
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it('validates the request body', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const sessionToken = await mintSession(app, apiKey.key)

    const res = await app.request(
      `/frontend/component-sessions/${sessionToken}/claim`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain: '' }),
      },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('returns 409 when the domain is already claimed for the project/mode', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const firstSession = await mintSession(app, apiKey.key)
    const first = await claimViaSession(
      app,
      firstSession,
      'conflict-example.test',
    )
    expect(first.status).toBe(201)

    const secondSession = await mintSession(app, apiKey.key)
    const second = await claimViaSession(
      app,
      secondSession,
      'conflict-example.test',
    )
    expect(second.status).toBe(409)
    const body = (await second.json()) as { error: { code: string } }
    expect(body.error.code).toBe('domain_already_claimed')
  })

  it('rejects a sandbox domain when the session came from a live-mode key', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey({ mode: 'live' })
    const sessionToken = await mintSession(app, apiKey.key)

    const res = await claimViaSession(app, sessionToken, 'sandbox-example.test')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('sandbox_requires_test_mode')
  })

  it('never leaks the project id or key material in the response', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const sessionToken = await mintSession(app, apiKey.key)

    const res = await claimViaSession(app, sessionToken, 'no-leak-example.test')
    const raw = await res.text()

    expect(raw).not.toContain(apiKey.projectId)
    expect(raw).not.toContain('projectId')
    expect(raw).not.toContain('accountId')
    expect(raw).not.toContain('keyId')
    expect(raw).not.toContain('secretHash')
  })

  it('is rate limited per session token, consistent with the plane', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()
    const sessionToken = await mintSession(app, apiKey.key)

    for (let i = 0; i < 10; i++) {
      // Deliberately invalid bodies: exercises the rate limiter without
      // ever consuming the session itself.
      await app.request(`/frontend/component-sessions/${sessionToken}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain: '' }),
      })
    }

    const blocked = await claimViaSession(
      app,
      sessionToken,
      'rate-limited-example.test',
    )
    expect(blocked.status).toBe(429)
    const body = (await blocked.json()) as { error: { code: string } }
    expect(body.error.code).toBe('rate_limited')
  })
})

describe('cross-key isolation', () => {
  it("a domain claimed via one key's component session is invisible through another project's key", async () => {
    const app = buildApp()
    const keyA = await createTestApiKey({ projectName: 'Project A' })
    const keyB = await createTestApiKey({ projectName: 'Project B' })

    const sessionToken = await mintSession(app, keyA.key)
    const claimRes = await claimViaSession(
      app,
      sessionToken,
      'isolated-example.test',
    )
    expect(claimRes.status).toBe(201)

    const asKeyB = await app.request('/v1/domains', {
      headers: { Authorization: `Bearer ${keyB.key}` },
    })
    const bodyB = (await asKeyB.json()) as {
      domains: Array<{ domain: string }>
    }
    expect(bodyB.domains.map((d) => d.domain)).not.toContain(
      'isolated-example.test',
    )

    const asKeyA = await app.request('/v1/domains', {
      headers: { Authorization: `Bearer ${keyA.key}` },
    })
    const bodyA = (await asKeyA.json()) as {
      domains: Array<{ domain: string }>
    }
    expect(bodyA.domains.map((d) => d.domain)).toContain(
      'isolated-example.test',
    )
  })
})
