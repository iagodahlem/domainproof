import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type Database } from '@infra/db/client'
import { accounts, projects } from '@infra/db/schema'
import { uniqueSlug } from '@shared/testing/unique-slug'
import { createWebhooksRepository } from './repository'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://domainproof:domainproof@localhost:5432/domainproof'

const db: Database = createDb(DATABASE_URL)
const repository = createWebhooksRepository(db)
const createdClerkUserIds: string[] = []

async function createTestProject(): Promise<string> {
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
      name: 'Test project',
      slug: uniqueSlug('test-project'),
    })
    .returning({ id: projects.id })
  if (!project) throw new Error('failed to create test project')

  return project.id
}

function endpointValues(
  projectId: string,
  overrides: {
    mode?: 'test' | 'live'
    url?: string
    eventTypes?: string[]
  } = {},
) {
  return {
    projectId,
    mode: overrides.mode ?? 'live',
    url: overrides.url ?? 'https://example.com/hooks/domainproof',
    signingSecret: `whsec_${randomUUID()}`,
    eventTypes: overrides.eventTypes ?? ['domain.verified'],
  } as const
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop()
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
    }
  }
})

describe('insertEndpoint', () => {
  it('persists a row with the given values', async () => {
    const projectId = await createTestProject()
    const row = await repository.insertEndpoint(
      endpointValues(projectId, {
        eventTypes: ['domain.verified', 'domain.failed'],
      }),
    )

    expect(row.projectId).toBe(projectId)
    expect(row.mode).toBe('live')
    expect(row.eventTypes).toEqual(['domain.verified', 'domain.failed'])
    expect(row.disabledAt).toBeNull()
  })
})

describe('listEndpointsByProject', () => {
  it('only returns endpoints for the given project', async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()

    await repository.insertEndpoint(endpointValues(projectA))
    await repository.insertEndpoint(endpointValues(projectB))

    expect(await repository.listEndpointsByProject(projectA)).toHaveLength(1)
    expect(await repository.listEndpointsByProject(projectB)).toHaveLength(1)
  })
})

describe('findEndpoint', () => {
  it('returns undefined for an endpoint belonging to a different project', async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()
    const created = await repository.insertEndpoint(endpointValues(projectA))

    expect(await repository.findEndpoint(projectA, created.id)).toBeDefined()
    expect(await repository.findEndpoint(projectB, created.id)).toBeUndefined()
  })
})

describe('deleteEndpoint', () => {
  it('deletes and returns the row', async () => {
    const projectId = await createTestProject()
    const created = await repository.insertEndpoint(endpointValues(projectId))

    const deleted = await repository.deleteEndpoint(projectId, created.id)
    expect(deleted?.id).toBe(created.id)
    expect(await repository.findEndpoint(projectId, created.id)).toBeUndefined()
  })

  it("returns undefined for an endpoint id that doesn't belong to the project", async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()
    const created = await repository.insertEndpoint(endpointValues(projectA))

    expect(
      await repository.deleteEndpoint(projectB, created.id),
    ).toBeUndefined()
  })
})

describe('setDisabled', () => {
  it('sets and clears disabledAt', async () => {
    const projectId = await createTestProject()
    const created = await repository.insertEndpoint(endpointValues(projectId))

    const disabled = await repository.setDisabled(projectId, created.id, true)
    expect(disabled?.disabledAt).toBeInstanceOf(Date)

    const enabled = await repository.setDisabled(projectId, created.id, false)
    expect(enabled?.disabledAt).toBeNull()
  })
})

describe('findActiveSubscribed', () => {
  it('matches project, mode, active status, and subscribed event type', async () => {
    const projectId = await createTestProject()
    const matching = await repository.insertEndpoint(
      endpointValues(projectId, {
        mode: 'test',
        eventTypes: ['domain.verified', 'domain.failed'],
      }),
    )
    // Wrong mode.
    await repository.insertEndpoint(
      endpointValues(projectId, {
        mode: 'live',
        eventTypes: ['domain.verified'],
      }),
    )
    // Not subscribed to this event type.
    await repository.insertEndpoint(
      endpointValues(projectId, {
        mode: 'test',
        eventTypes: ['domain.failed'],
      }),
    )
    // Disabled.
    const disabled = await repository.insertEndpoint(
      endpointValues(projectId, {
        mode: 'test',
        eventTypes: ['domain.verified'],
      }),
    )
    await repository.setDisabled(projectId, disabled.id, true)

    const found = await repository.findActiveSubscribed(
      projectId,
      'test',
      'domain.verified',
    )
    expect(found.map((row) => row.id)).toEqual([matching.id])
  })

  it("doesn't match endpoints from another project", async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()
    await repository.insertEndpoint(
      endpointValues(projectA, {
        mode: 'test',
        eventTypes: ['domain.verified'],
      }),
    )

    expect(
      await repository.findActiveSubscribed(
        projectB,
        'test',
        'domain.verified',
      ),
    ).toHaveLength(0)
  })
})

describe('deliveries', () => {
  it('inserts with an explicit id and reads it back via listDeliveriesByEndpoint', async () => {
    const projectId = await createTestProject()
    const endpoint = await repository.insertEndpoint(endpointValues(projectId))
    const deliveryId = randomUUID()

    await repository.insertDelivery({
      id: deliveryId,
      endpointId: endpoint.id,
      eventType: 'domain.verified',
      payload: { id: deliveryId, type: 'domain.verified', data: {} },
    })

    const { rows, hasMore } = await repository.listDeliveriesByEndpoint(
      endpoint.id,
      { limit: 10 },
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe(deliveryId)
    expect(rows[0]?.status).toBe('pending')
    expect(rows[0]?.attempt).toBe(1)
    expect(hasMore).toBe(false)
  })

  it('paginates newest first with a cursor', async () => {
    const projectId = await createTestProject()
    const endpoint = await repository.insertEndpoint(endpointValues(projectId))
    const ids: string[] = []

    for (let i = 0; i < 3; i += 1) {
      const id = randomUUID()
      ids.push(id)
      await repository.insertDelivery({
        id,
        endpointId: endpoint.id,
        eventType: 'domain.verified',
        payload: { id, type: 'domain.verified', data: {} },
      })
    }

    const firstPage = await repository.listDeliveriesByEndpoint(endpoint.id, {
      limit: 2,
    })
    expect(firstPage.rows).toHaveLength(2)
    expect(firstPage.hasMore).toBe(true)
    // Newest first: the most recently inserted id leads.
    expect(firstPage.rows[0]?.id).toBe(ids[2])

    const lastRow = firstPage.rows[firstPage.rows.length - 1]
    if (!lastRow) throw new Error('expected a last row')

    const secondPage = await repository.listDeliveriesByEndpoint(endpoint.id, {
      limit: 2,
      cursor: { id: lastRow.id },
    })
    expect(secondPage.rows).toHaveLength(1)
    expect(secondPage.rows[0]?.id).toBe(ids[0])
    expect(secondPage.hasMore).toBe(false)
  })

  it('markSucceeded sets status, responseStatus, deliveredAt, and clears nextRetryAt', async () => {
    const projectId = await createTestProject()
    const endpoint = await repository.insertEndpoint(endpointValues(projectId))
    const id = randomUUID()
    await repository.insertDelivery({
      id,
      endpointId: endpoint.id,
      eventType: 'domain.verified',
      payload: {},
    })
    await repository.markRetryScheduled(id, {
      attempt: 2,
      responseStatus: 500,
      nextRetryAt: new Date(Date.now() + 1000),
    })

    await repository.markSucceeded(id, { responseStatus: 200 })

    const { rows } = await repository.listDeliveriesByEndpoint(endpoint.id, {
      limit: 10,
    })
    const row = rows[0]
    expect(row?.status).toBe('succeeded')
    expect(row?.responseStatus).toBe(200)
    expect(row?.deliveredAt).toBeInstanceOf(Date)
    expect(row?.nextRetryAt).toBeNull()
  })

  it('markFailed sets status and clears nextRetryAt', async () => {
    const projectId = await createTestProject()
    const endpoint = await repository.insertEndpoint(endpointValues(projectId))
    const id = randomUUID()
    await repository.insertDelivery({
      id,
      endpointId: endpoint.id,
      eventType: 'domain.verified',
      payload: {},
    })

    await repository.markFailed(id, { responseStatus: 500 })

    const { rows } = await repository.listDeliveriesByEndpoint(endpoint.id, {
      limit: 10,
    })
    expect(rows[0]?.status).toBe('failed')
    expect(rows[0]?.responseStatus).toBe(500)
    expect(rows[0]?.nextRetryAt).toBeNull()
  })

  it('markRetryScheduled bumps attempt and sets nextRetryAt without changing status', async () => {
    const projectId = await createTestProject()
    const endpoint = await repository.insertEndpoint(endpointValues(projectId))
    const id = randomUUID()
    await repository.insertDelivery({
      id,
      endpointId: endpoint.id,
      eventType: 'domain.verified',
      payload: {},
    })
    const nextRetryAt = new Date(Date.now() + 60_000)

    await repository.markRetryScheduled(id, {
      attempt: 2,
      responseStatus: 503,
      nextRetryAt,
    })

    const { rows } = await repository.listDeliveriesByEndpoint(endpoint.id, {
      limit: 10,
    })
    expect(rows[0]?.status).toBe('pending')
    expect(rows[0]?.attempt).toBe(2)
    expect(rows[0]?.responseStatus).toBe(503)
    expect(rows[0]?.nextRetryAt?.getTime()).toBe(nextRetryAt.getTime())
  })
})

describe('findDeliveryForRedeliver', () => {
  it('resolves when the delivery, endpoint, and project all match', async () => {
    const projectId = await createTestProject()
    const endpoint = await repository.insertEndpoint(endpointValues(projectId))
    const id = randomUUID()
    await repository.insertDelivery({
      id,
      endpointId: endpoint.id,
      eventType: 'domain.verified',
      payload: { data: { domain: 'example.com' } },
    })

    const found = await repository.findDeliveryForRedeliver(
      projectId,
      endpoint.id,
      id,
    )
    expect(found?.delivery.id).toBe(id)
    expect(found?.endpoint.id).toBe(endpoint.id)
  })

  it('returns undefined when the endpoint belongs to a different project', async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()
    const endpoint = await repository.insertEndpoint(endpointValues(projectA))
    const id = randomUUID()
    await repository.insertDelivery({
      id,
      endpointId: endpoint.id,
      eventType: 'domain.verified',
      payload: {},
    })

    expect(
      await repository.findDeliveryForRedeliver(projectB, endpoint.id, id),
    ).toBeUndefined()
  })

  it("returns undefined for a delivery id that doesn't belong to the endpoint", async () => {
    const projectId = await createTestProject()
    const endpointA = await repository.insertEndpoint(endpointValues(projectId))
    const endpointB = await repository.insertEndpoint(endpointValues(projectId))
    const id = randomUUID()
    await repository.insertDelivery({
      id,
      endpointId: endpointA.id,
      eventType: 'domain.verified',
      payload: {},
    })

    expect(
      await repository.findDeliveryForRedeliver(projectId, endpointB.id, id),
    ).toBeUndefined()
  })
})
