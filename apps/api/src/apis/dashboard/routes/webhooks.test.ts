import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app'
import type { SessionVerifier } from '@modules/accounts/ports'
import type {
  WebhookDeliveryRequest,
  WebhookSender,
} from '@modules/webhooks/ports'
import { createDb, type Database } from '@infra/db/client'
import { accounts } from '@infra/db/schema'

// Auth here is a fake SessionVerifier implementing the port directly, same
// as apis/dashboard/routes/keys.test.ts — the real Clerk verifier's own
// behavior is covered by infra/auth/clerk.test.ts. Delivery goes through a
// fake WebhookSender: this file never makes a real network request, and
// (unless a test configures otherwise) the fake always reports success so
// a delivery settles almost immediately.
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

interface FakeSenderResult {
  ok: boolean
  status?: number
}

function fakeWebhookSender(
  results: FakeSenderResult[] = [{ ok: true, status: 200 }],
): { sender: WebhookSender; calls: WebhookDeliveryRequest[] } {
  const calls: WebhookDeliveryRequest[] = []
  let index = 0

  return {
    sender: {
      async send(request) {
        calls.push(request)
        const result = results[Math.min(index, results.length - 1)]
        index += 1
        return result ?? { ok: true, status: 200 }
      },
    },
    calls,
  }
}

function buildApp(overrides: { webhookSender?: WebhookSender } = {}) {
  return createApp({
    db,
    sessionVerifier: fakeSessionVerifier,
    webhookSender: overrides.webhookSender ?? fakeWebhookSender().sender,
  })
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

async function withKey(
  app: ReturnType<typeof buildApp>,
  key: string,
  path: string,
  init: RequestInit = {},
) {
  return app.request(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${key}` },
  })
}

/** Creates a project and returns its id plus its bootstrap test-mode API key (see `modules/projects/service.ts`'s `createProject`). */
async function createProject(
  app: ReturnType<typeof buildApp>,
  clerkUserId: string,
  name = 'Test project',
): Promise<{ projectId: string; testKey: string }> {
  const res = await asUser(app, clerkUserId, '/dashboard/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const body = (await res.json()) as {
    project: { id: string }
    keys: { test: { key: string } }
  }
  return { projectId: body.project.id, testKey: body.keys.test.key }
}

async function createEndpoint(
  app: ReturnType<typeof buildApp>,
  clerkUserId: string,
  projectId: string,
  overrides: {
    url?: string
    mode?: 'test' | 'live'
    eventTypes?: string[]
  } = {},
) {
  const res = await asUser(
    app,
    clerkUserId,
    `/dashboard/projects/${projectId}/webhooks`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: overrides.url ?? 'https://example.com/hooks/domainproof',
        mode: overrides.mode ?? 'live',
        eventTypes: overrides.eventTypes ?? ['domain.verified'],
      }),
    },
  )
  const body = (await res.json()) as {
    secret: string
    endpoint: { id: string; maskedSecret: string }
  }
  return { res, body }
}

describe('/dashboard/projects/:projectId/webhooks', () => {
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
    const res = await app.request('/dashboard/projects/anything/webhooks')
    expect(res.status).toBe(401)
  })

  it("404s for a project that doesn't exist", async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${randomUUID()}/webhooks`,
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it("404s (not 403) for another account's project", async () => {
    const app = buildApp()
    const ownerId = freshClerkUserId()
    const otherId = freshClerkUserId()
    const { projectId } = await createProject(app, ownerId)

    const res = await asUser(
      app,
      otherId,
      `/dashboard/projects/${projectId}/webhooks`,
    )
    expect(res.status).toBe(404)
  })

  it('creates and lists an endpoint, never returning the full secret after creation', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const { projectId } = await createProject(app, clerkUserId)

    const { res: createRes, body: created } = await createEndpoint(
      app,
      clerkUserId,
      projectId,
      { eventTypes: ['domain.verified', 'domain.failed'] },
    )
    expect(createRes.status).toBe(201)
    expect(created.secret).toMatch(/^whsec_[a-z2-7]{26}$/)
    expect(created.endpoint.maskedSecret).toBe(
      `whsec_...${created.secret.slice(-4)}`,
    )

    const listRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks`,
    )
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as {
      endpoints: Array<Record<string, unknown>>
    }
    expect(listBody.endpoints).toHaveLength(1)

    const serialized = JSON.stringify(listBody)
    expect(serialized).not.toContain(created.secret)
  })

  it('rejects an invalid url', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const { projectId } = await createProject(app, clerkUserId)

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'not-a-url',
          mode: 'live',
          eventTypes: ['domain.verified'],
        }),
      },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('invalid_request')
  })

  it('rejects an empty eventTypes list', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const { projectId } = await createProject(app, clerkUserId)

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/hook',
          mode: 'live',
          eventTypes: [],
        }),
      },
    )
    expect(res.status).toBe(400)
  })

  it('rejects an unknown event type', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const { projectId } = await createProject(app, clerkUserId)

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/hook',
          mode: 'live',
          eventTypes: ['account.created'],
        }),
      },
    )
    expect(res.status).toBe(400)
  })

  it('disables and re-enables an endpoint', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const { projectId } = await createProject(app, clerkUserId)
    const { body: created } = await createEndpoint(app, clerkUserId, projectId)

    const disableRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}/disable`,
      { method: 'POST' },
    )
    expect(disableRes.status).toBe(200)
    const disabled = (await disableRes.json()) as {
      endpoint: { disabled: boolean }
    }
    expect(disabled.endpoint.disabled).toBe(true)

    const enableRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}/enable`,
      { method: 'POST' },
    )
    expect(enableRes.status).toBe(200)
    const enabled = (await enableRes.json()) as {
      endpoint: { disabled: boolean }
    }
    expect(enabled.endpoint.disabled).toBe(false)
  })

  it('deletes an endpoint', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const { projectId } = await createProject(app, clerkUserId)
    const { body: created } = await createEndpoint(app, clerkUserId, projectId)

    const deleteRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}`,
      { method: 'DELETE' },
    )
    expect(deleteRes.status).toBe(200)

    const listRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks`,
    )
    const listBody = (await listRes.json()) as { endpoints: unknown[] }
    expect(listBody.endpoints).toHaveLength(0)
  })

  it("404s (not 403) when acting on another account's endpoint, via that account's own project", async () => {
    const app = buildApp()
    const ownerId = freshClerkUserId()
    const otherId = freshClerkUserId()
    const { projectId: ownerProjectId } = await createProject(app, ownerId)
    const { projectId: otherProjectId } = await createProject(app, otherId)
    const { body: created } = await createEndpoint(app, ownerId, ownerProjectId)

    // otherId owns a project, but not ownerId's — the endpointId 404s under
    // otherId's own project, same as an unknown endpointId would.
    const disableAsOther = await asUser(
      app,
      otherId,
      `/dashboard/projects/${otherProjectId}/webhooks/${created.endpoint.id}/disable`,
      { method: 'POST' },
    )
    expect(disableAsOther.status).toBe(404)
    const body = (await disableAsOther.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')

    const deleteAsOther = await asUser(
      app,
      otherId,
      `/dashboard/projects/${otherProjectId}/webhooks/${created.endpoint.id}`,
      { method: 'DELETE' },
    )
    expect(deleteAsOther.status).toBe(404)

    const deliveriesAsOther = await asUser(
      app,
      otherId,
      `/dashboard/projects/${otherProjectId}/webhooks/${created.endpoint.id}/deliveries`,
    )
    expect(deliveriesAsOther.status).toBe(404)

    // Untouched from the owner's perspective.
    const listRes = await asUser(
      app,
      ownerId,
      `/dashboard/projects/${ownerProjectId}/webhooks`,
    )
    const listBody = (await listRes.json()) as { endpoints: unknown[] }
    expect(listBody.endpoints).toHaveLength(1)
  })
})

describe('deliveries and redeliver', () => {
  afterEach(async () => {
    while (createdClerkUserIds.length > 0) {
      const clerkUserId = createdClerkUserIds.pop()
      if (clerkUserId) {
        await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
      }
    }
  })

  it('the claim -> verify flow produces deliveries for a subscribed endpoint', async () => {
    const { sender } = fakeWebhookSender()
    const app = buildApp({ webhookSender: sender })
    const clerkUserId = freshClerkUserId()
    const { projectId, testKey: apiKey } = await createProject(app, clerkUserId)

    const { body: created } = await createEndpoint(
      app,
      clerkUserId,
      projectId,
      {
        mode: 'test',
        eventTypes: [
          'domain.claimed',
          'domain.check_passed',
          'domain.verified',
        ],
      },
    )

    const claimRes = await withKey(app, apiKey, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'verified.test' }),
    })
    expect(claimRes.status).toBe(201)
    const claimed = (await claimRes.json()) as { domain: { id: string } }

    const verifyRes = await withKey(
      app,
      apiKey,
      `/v1/domains/${claimed.domain.id}/verify`,
      { method: 'POST' },
    )
    expect(verifyRes.status).toBe(200)

    const deliveriesRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}/deliveries`,
    )
    expect(deliveriesRes.status).toBe(200)
    const deliveriesBody = (await deliveriesRes.json()) as {
      deliveries: Array<{ eventType: string }>
    }

    // domain.claimed (claim) + domain.check_passed + domain.verified (verify).
    expect(deliveriesBody.deliveries).toHaveLength(3)
    expect(deliveriesBody.deliveries.map((d) => d.eventType).sort()).toEqual(
      ['domain.check_passed', 'domain.claimed', 'domain.verified'].sort(),
    )
  })

  it('paginates the delivery log with a cursor', async () => {
    const { sender } = fakeWebhookSender()
    const app = buildApp({ webhookSender: sender })
    const clerkUserId = freshClerkUserId()
    const { projectId, testKey: apiKey } = await createProject(app, clerkUserId)

    const { body: created } = await createEndpoint(
      app,
      clerkUserId,
      projectId,
      {
        mode: 'test',
        eventTypes: ['domain.claimed'],
      },
    )

    for (const domain of ['verified.test', 'wrong-value.test']) {
      const res = await withKey(app, apiKey, '/v1/domains', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      expect(res.status).toBe(201)
    }

    const firstPage = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}/deliveries?limit=1`,
    )
    const firstBody = (await firstPage.json()) as {
      deliveries: unknown[]
      nextCursor: string | null
    }
    expect(firstBody.deliveries).toHaveLength(1)
    expect(firstBody.nextCursor).not.toBeNull()

    const secondPage = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}/deliveries?limit=1&cursor=${firstBody.nextCursor}`,
    )
    const secondBody = (await secondPage.json()) as {
      deliveries: unknown[]
      nextCursor: string | null
    }
    expect(secondBody.deliveries).toHaveLength(1)
    expect(secondBody.nextCursor).toBeNull()
  })

  it('redelivers a delivery as a fresh entry in the log', async () => {
    const { sender } = fakeWebhookSender()
    const app = buildApp({ webhookSender: sender })
    const clerkUserId = freshClerkUserId()
    const { projectId, testKey: apiKey } = await createProject(app, clerkUserId)

    const { body: created } = await createEndpoint(
      app,
      clerkUserId,
      projectId,
      {
        mode: 'test',
        eventTypes: ['domain.claimed'],
      },
    )

    await withKey(app, apiKey, '/v1/domains', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'verified.test' }),
    })

    const deliveriesRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}/deliveries`,
    )
    const deliveriesBody = (await deliveriesRes.json()) as {
      deliveries: Array<{ id: string }>
    }
    const original = deliveriesBody.deliveries[0]
    if (!original) throw new Error('expected a delivery to redeliver')

    const redeliverRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}/deliveries/${original.id}/redeliver`,
      { method: 'POST' },
    )
    expect(redeliverRes.status).toBe(201)
    const redelivered = (await redeliverRes.json()) as {
      delivery: { id: string; attempt: number }
    }
    expect(redelivered.delivery.id).not.toBe(original.id)
    expect(redelivered.delivery.attempt).toBe(1)

    const afterRes = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}/deliveries`,
    )
    const afterBody = (await afterRes.json()) as { deliveries: unknown[] }
    expect(afterBody.deliveries).toHaveLength(2)
  })

  it('returns 404 for a redeliver of an unknown delivery id', async () => {
    const app = buildApp()
    const clerkUserId = freshClerkUserId()
    const { projectId } = await createProject(app, clerkUserId)
    const { body: created } = await createEndpoint(app, clerkUserId, projectId)

    const res = await asUser(
      app,
      clerkUserId,
      `/dashboard/projects/${projectId}/webhooks/${created.endpoint.id}/deliveries/${randomUUID()}/redeliver`,
      { method: 'POST' },
    )
    expect(res.status).toBe(404)
  })
})
