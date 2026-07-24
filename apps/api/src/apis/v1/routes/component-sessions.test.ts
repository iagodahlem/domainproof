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
  projects,
} from '@infra/db/schema'
import { generateKeyId } from '@modules/keys/domain/encoding'
import { uniqueSlug } from '@shared/testing/unique-slug'

/**
 * End-to-end coverage of `POST /v1/component-sessions`: real api-key auth,
 * real db. `apis/frontend/routes/component-sessions.test.ts` covers the
 * rest of the mint -> claim -> verify journey.
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
  overrides: { mode?: 'test' | 'live' } = {},
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
      name: 'Component Session Mint Test',
      slug: uniqueSlug('cst'),
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

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop()
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
    }
  }
})

describe('POST /v1/component-sessions', () => {
  it('mints a session scoped to the key project/mode, with no externalId', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey({ mode: 'live' })

    const res = await app.request('/v1/component-sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      sessionToken: string
      expiresAt: string
    }
    expect(typeof body.sessionToken).toBe('string')
    expect(body.sessionToken.length).toBeGreaterThan(0)
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now())

    const [row] = await db
      .select()
      .from(componentSessions)
      .where(eq(componentSessions.token, body.sessionToken))
    expect(row?.projectId).toBe(apiKey.projectId)
    expect(row?.mode).toBe('live')
    expect(row?.externalId).toBeNull()
    expect(row?.consumedAt).toBeNull()
  })

  it('persists the given externalId on the minted session', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await app.request('/v1/component-sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ externalId: 'user_42' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { sessionToken: string }

    const [row] = await db
      .select()
      .from(componentSessions)
      .where(eq(componentSessions.token, body.sessionToken))
    expect(row?.externalId).toBe('user_42')
  })

  it('rejects a request with no api key', async () => {
    const app = buildApp()

    const res = await app.request('/v1/component-sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_api_key')
  })

  it('rejects an overlong externalId', async () => {
    const app = buildApp()
    const apiKey = await createTestApiKey()

    const res = await app.request('/v1/component-sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ externalId: 'x'.repeat(256) }),
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })
})
