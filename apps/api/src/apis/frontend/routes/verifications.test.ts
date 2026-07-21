import { createHash, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { generateToken } from '@domainproof/core'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import { createDb, type Database } from '@infra/db/client'
import { accounts, apiKeys, projects } from '@infra/db/schema'
import { generateKeyId } from '@modules/keys/domain/encoding'

/**
 * End-to-end coverage of the Frontend API plane: claims a domain through
 * the real `/v1/domains` wiring (the only place a `frontendToken` is
 * actually minted), extracts the token from the returned
 * `verificationUrl` — exactly how a real caller would learn it — and
 * drives the rest of the journey through `/frontend/verifications/:token`
 * against a real db. `middlewares/token-rate-limit.test.ts` covers the
 * rate limiter's own windowing logic in isolation.
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
    .values({ accountId: account.id, name: 'Frontend Plane Test', slug: 'fpt' })
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

/** Extracts the token segment (last path component) of a `verificationUrl`. */
function tokenFromVerificationUrl(verificationUrl: string): string {
  const token = verificationUrl.split('/').pop()
  if (!token)
    throw new Error(`could not parse a token out of ${verificationUrl}`)
  return token
}

async function claimDomain(
  app: ReturnType<typeof buildApp>,
  key: string,
  domain: string,
  options: { externalId?: string } = {},
): Promise<{ id: string; token: string }> {
  const res = await app.request('/v1/domains', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ domain, external_id: options.externalId }),
  })
  expect(res.status).toBe(201)
  const body = (await res.json()) as {
    domain: { id: string; verificationUrl: string }
  }
  return {
    id: body.domain.id,
    token: tokenFromVerificationUrl(body.domain.verificationUrl),
  }
}

describe('/frontend/verifications', () => {
  afterEach(async () => {
    while (createdClerkUserIds.length > 0) {
      const clerkUserId = createdClerkUserIds.pop()
      if (clerkUserId) {
        await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
      }
    }
  })

  describe('GET /:token', () => {
    it("reads a pending claim's status and record instructions by token, with no session or api key", async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const { token } = await claimDomain(
        app,
        apiKey.key,
        'pending-example.test',
      )

      const res = await app.request(`/frontend/verifications/${token}`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        domain: string
        mode: string
        status: string
        projectName: string
        records: Array<{ label: string; type: string; value: string }>
        check: unknown
        updatedAt: string
      }
      expect(body.domain).toBe('pending-example.test')
      expect(body.mode).toBe('test')
      expect(body.status).toBe('pending')
      expect(body.projectName).toBe('Frontend Plane Test')
      expect(body.check).toBeNull()
      expect(typeof body.updatedAt).toBe('string')

      expect(body.records).toHaveLength(1)
      const [record] = body.records
      expect(record?.type).toBe('TXT')
      expect(record?.label).toMatch(/^_fpt-challenge\.pending-example\.test$/)
      expect(record?.value).toMatch(/^fpt-verify=[a-z2-7]{26}$/)
    })

    it('never leaks account, project, or key ids in the response', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const { id: domainId, token } = await claimDomain(
        app,
        apiKey.key,
        'no-leak-example.test',
      )

      const res = await app.request(`/frontend/verifications/${token}`)
      const raw = await res.text()

      expect(raw).not.toContain(apiKey.projectId)
      expect(raw).not.toContain(domainId)
      expect(raw).not.toContain('accountId')
      expect(raw).not.toContain('projectId')
      expect(raw).not.toContain('keyId')
      expect(raw).not.toContain('secretHash')
    })

    it("never leaks the claiming project's external_id — that's the builder's internal identifier for their end user, not something the end user's own hosted verification page should see", async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const { token } = await claimDomain(
        app,
        apiKey.key,
        'external-id-no-leak.test',
        { externalId: 'customer_42' },
      )

      const res = await app.request(`/frontend/verifications/${token}`)
      expect(res.status).toBe(200)
      const raw = await res.clone().text()
      expect(raw).not.toContain('customer_42')
      expect(raw).not.toContain('external_id')
      expect(raw).not.toContain('externalId')

      const body = (await res.json()) as Record<string, unknown>
      expect(body).not.toHaveProperty('externalId')
      expect(body).not.toHaveProperty('external_id')
    })

    it('returns 404 for an unknown token', async () => {
      const app = buildApp()

      const res = await app.request('/frontend/verifications/unknown-token')
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })

    it("returns 404 for a released domain's now-defunct token", async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const { id: domainId, token } = await claimDomain(
        app,
        apiKey.key,
        'released-example.test',
      )

      const release = await app.request(`/v1/domains/${domainId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey.key}` },
      })
      expect(release.status).toBe(200)

      const res = await app.request(`/frontend/verifications/${token}`)
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })
  })

  describe('POST /:token/check', () => {
    it('runs the standard verify path, transitions status, and matches the GET shape', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const { token } = await claimDomain(app, apiKey.key, 'verified.test')

      const checkRes = await app.request(
        `/frontend/verifications/${token}/check`,
        {
          method: 'POST',
        },
      )
      expect(checkRes.status).toBe(200)
      const checkBody = (await checkRes.json()) as {
        status: string
        check: { outcome: string; checkedAt: string }
      }
      expect(checkBody.status).toBe('verified')
      expect(checkBody.check.outcome).toBe('found')

      const getRes = await app.request(`/frontend/verifications/${token}`)
      const getBody = (await getRes.json()) as {
        status: string
        check: { outcome: string }
      }
      expect(getBody.status).toBe('verified')
      expect(getBody.check.outcome).toBe('found')
    })

    it('surfaces expected/detected material for a wrong-value check, matching /v1/domains/:id/verify', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const { token } = await claimDomain(app, apiKey.key, 'wrong-value.test')

      const res = await app.request(`/frontend/verifications/${token}/check`, {
        method: 'POST',
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        check: { outcome: string; expected?: string; detected?: string[] }
      }
      expect(body.check.outcome).toBe('wrong_value')
      expect(typeof body.check.expected).toBe('string')
      expect(body.check.detected).toEqual(
        expect.arrayContaining([expect.any(String)]),
      )
    })

    it('blocks a second check on the same token within 15 seconds', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const { token } = await claimDomain(app, apiKey.key, 'nxdomain.test')

      const first = await app.request(
        `/frontend/verifications/${token}/check`,
        {
          method: 'POST',
        },
      )
      expect(first.status).toBe(200)

      const second = await app.request(
        `/frontend/verifications/${token}/check`,
        {
          method: 'POST',
        },
      )
      expect(second.status).toBe(429)
      const body = (await second.json()) as { error: { code: string } }
      expect(body.error.code).toBe('rate_limited')
      expect(second.headers.get('Retry-After')).toBeTruthy()
    })

    it('returns 404 for an unknown token', async () => {
      const app = buildApp()

      const res = await app.request(
        '/frontend/verifications/unknown-token/check',
        {
          method: 'POST',
        },
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })
  })

  describe('GET /:token/events', () => {
    it('returns the claim + check timeline, with no domain/project ids in each event', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const { id: domainId, token } = await claimDomain(
        app,
        apiKey.key,
        'verified.test',
      )
      await app.request(`/frontend/verifications/${token}/check`, {
        method: 'POST',
      })

      const res = await app.request(`/frontend/verifications/${token}/events`)
      expect(res.status).toBe(200)
      const raw = await res.clone().text()
      expect(raw).not.toContain(domainId)
      expect(raw).not.toContain(apiKey.projectId)
      expect(raw).not.toContain('domainId')
      expect(raw).not.toContain('projectId')

      const body = (await res.json()) as {
        events: Array<{ id: string; type: string; mode: string }>
        nextCursor: string | null
      }
      expect(body.events.map((event) => event.type)).toEqual([
        'domain.claimed',
        'domain.check_passed',
        'domain.verified',
      ])
      expect(body.events.every((event) => event.mode === 'test')).toBe(true)
      expect(body.nextCursor).toBeNull()
    })

    it('returns 404 for an unknown token', async () => {
      const app = buildApp()

      const res = await app.request(
        '/frontend/verifications/unknown-token/events',
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_found')
    })
  })
})
