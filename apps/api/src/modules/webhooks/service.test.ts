import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  WEBHOOK_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  signPayload,
} from './domain/signing'
import type { WebhookDeliveryRequest, WebhookSender } from './ports'
import type {
  WebhookDeliveryRow,
  WebhookEndpointRow,
  WebhooksRepository,
} from './repository'
import { createFakeLogger } from '@shared/testing/fake-logger'
import { createWebhooksService } from './service'

/**
 * A fake `WebhooksRepository` implementing the port in memory — no real
 * db. The repository's own persistence/query correctness is covered by
 * repository.test.ts against a real db; this file only tests the
 * service's orchestration (secret masking, dispatch fan-out, retry
 * accounting, redeliver, the "never blocks" contract).
 */
function fakeRepository(): {
  repo: WebhooksRepository
  deliveries: Map<string, WebhookDeliveryRow>
} {
  const endpoints = new Map<string, WebhookEndpointRow>()
  const deliveries = new Map<string, WebhookDeliveryRow>()

  const repo: WebhooksRepository = {
    async insertEndpoint(values) {
      const row: WebhookEndpointRow = {
        id: randomUUID(),
        projectId: values.projectId,
        mode: values.mode,
        url: values.url,
        signingSecret: values.signingSecret,
        eventTypes: values.eventTypes,
        disabledAt: null,
        createdAt: new Date(),
      }
      endpoints.set(row.id, row)
      return row
    },

    async listEndpointsByProject(projectId) {
      return [...endpoints.values()].filter((e) => e.projectId === projectId)
    },

    async findEndpoint(projectId, endpointId) {
      const row = endpoints.get(endpointId)
      return row && row.projectId === projectId ? row : undefined
    },

    async deleteEndpoint(projectId, endpointId) {
      const row = endpoints.get(endpointId)
      if (!row || row.projectId !== projectId) return undefined
      endpoints.delete(endpointId)
      return row
    },

    async setDisabled(projectId, endpointId, disabled) {
      const row = endpoints.get(endpointId)
      if (!row || row.projectId !== projectId) return undefined
      const updated = { ...row, disabledAt: disabled ? new Date() : null }
      endpoints.set(endpointId, updated)
      return updated
    },

    async findActiveSubscribed(projectId, mode, eventType) {
      return [...endpoints.values()].filter(
        (e) =>
          e.projectId === projectId &&
          e.mode === mode &&
          e.disabledAt === null &&
          e.eventTypes.includes(eventType),
      )
    },

    async insertDelivery(values) {
      const row: WebhookDeliveryRow = {
        id: values.id,
        endpointId: values.endpointId,
        eventType: values.eventType,
        payload: values.payload,
        attempt: 1,
        status: 'pending',
        responseStatus: null,
        deliveredAt: null,
        nextRetryAt: null,
        createdAt: new Date(),
      }
      deliveries.set(row.id, row)
      return row
    },

    async findDeliveryForRedeliver(projectId, endpointId, deliveryId) {
      const endpoint = endpoints.get(endpointId)
      const delivery = deliveries.get(deliveryId)
      if (!endpoint || endpoint.projectId !== projectId) return undefined
      if (!delivery || delivery.endpointId !== endpointId) return undefined
      return { endpoint, delivery }
    },

    async listDeliveriesByEndpoint(endpointId, { limit, cursor }) {
      const all = [...deliveries.values()]
        .filter((d) => d.endpointId === endpointId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      const startIndex = cursor
        ? all.findIndex((d) => d.id === cursor.id) + 1
        : 0
      const remaining = all.slice(startIndex)
      const hasMore = remaining.length > limit
      return {
        rows: hasMore ? remaining.slice(0, limit) : remaining,
        hasMore,
      }
    },

    async markSucceeded(deliveryId, values) {
      const row = deliveries.get(deliveryId)
      if (!row) return
      deliveries.set(deliveryId, {
        ...row,
        status: 'succeeded',
        responseStatus: values.responseStatus,
        deliveredAt: values.deliveredAt ?? new Date(),
        nextRetryAt: null,
      })
    },

    async markFailed(deliveryId, values) {
      const row = deliveries.get(deliveryId)
      if (!row) return
      deliveries.set(deliveryId, {
        ...row,
        status: 'failed',
        responseStatus: values.responseStatus,
        nextRetryAt: null,
      })
    },

    async markRetryScheduled(deliveryId, values) {
      const row = deliveries.get(deliveryId)
      if (!row) return
      deliveries.set(deliveryId, {
        ...row,
        attempt: values.attempt,
        responseStatus: values.responseStatus,
        nextRetryAt: values.nextRetryAt,
      })
    },
  }

  return { repo, deliveries }
}

interface FakeSenderResult {
  ok: boolean
  status?: number
}

function fakeSender(results: FakeSenderResult[]): {
  sender: WebhookSender
  calls: WebhookDeliveryRequest[]
} {
  const calls: WebhookDeliveryRequest[] = []
  let index = 0

  const sender: WebhookSender = {
    async send(request) {
      calls.push(request)
      const result = results[Math.min(index, results.length - 1)]
      index += 1
      if (!result) {
        throw new Error('fakeSender ran out of configured results')
      }
      return result
    },
  }

  return { sender, calls }
}

const noWait = async (): Promise<void> => {}

const PAYLOAD = {
  domainId: 'domain_1',
  projectId: 'project_1',
  mode: 'live' as const,
  domain: 'example.com',
}

describe('createEndpoint', () => {
  it('returns the full secret once and a masked summary that never leaks it', async () => {
    const { repo } = fakeRepository()
    const { sender } = fakeSender([{ ok: true, status: 200 }])
    const service = createWebhooksService(repo, sender, {}, createFakeLogger())

    const result = await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )

    expect(result.secret).toMatch(/^whsec_[a-z2-7]{26}$/)
    expect(result.endpoint.maskedSecret).toBe(
      `whsec_...${result.secret.slice(-4)}`,
    )
    expect(JSON.stringify(result.endpoint)).not.toContain(result.secret)
    expect(result.endpoint.disabled).toBe(false)
    expect(result.endpoint.eventTypes).toEqual(['domain.verified'])
  })
})

describe('listEndpoints / deleteEndpoint / disableEndpoint / enableEndpoint', () => {
  it('scopes every operation to the project, returning null/empty for another project', async () => {
    const { repo } = fakeRepository()
    const { sender } = fakeSender([{ ok: true, status: 200 }])
    const service = createWebhooksService(repo, sender, {}, createFakeLogger())

    const { endpoint } = await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )

    expect(await service.listEndpoints('project_2')).toHaveLength(0)
    expect(await service.disableEndpoint('project_2', endpoint.id)).toBeNull()
    expect(await service.enableEndpoint('project_2', endpoint.id)).toBeNull()
    expect(await service.deleteEndpoint('project_2', endpoint.id)).toBeNull()

    const disabled = await service.disableEndpoint('project_1', endpoint.id)
    expect(disabled?.disabled).toBe(true)

    const enabled = await service.enableEndpoint('project_1', endpoint.id)
    expect(enabled?.disabled).toBe(false)

    const deleted = await service.deleteEndpoint('project_1', endpoint.id)
    expect(deleted?.id).toBe(endpoint.id)
    expect(await service.listEndpoints('project_1')).toHaveLength(0)
  })
})

describe('dispatchEvent', () => {
  it('only delivers to active endpoints subscribed to that event type/project/mode', async () => {
    const { repo } = fakeRepository()
    const { sender, calls } = fakeSender([{ ok: true, status: 200 }])
    const service = createWebhooksService(
      repo,
      sender,
      { wait: noWait },
      createFakeLogger(),
    )

    await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/matching',
      ['domain.verified'],
    )
    await service.createEndpoint(
      'project_1',
      'test', // wrong mode
      'https://example.com/wrong-mode',
      ['domain.verified'],
    )
    await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/wrong-event',
      ['domain.failed'], // not subscribed
    )
    const { endpoint: toDisable } = await service.createEndpoint(
      'project_2',
      'live',
      'https://example.com/wrong-project',
      ['domain.verified'],
    )
    void toDisable

    const created = await service.dispatchEvent('domain.verified', PAYLOAD)
    await service.waitForPendingDeliveries()

    expect(created).toHaveLength(1)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://example.com/matching')
  })

  it('builds the envelope as { id, type, created_at, data } and signs it correctly', async () => {
    const { repo } = fakeRepository()
    const { sender, calls } = fakeSender([{ ok: true, status: 200 }])
    const now = () => new Date('2026-01-01T00:00:00.000Z')
    const service = createWebhooksService(
      repo,
      sender,
      { now, wait: noWait },
      createFakeLogger(),
    )

    const { secret } = await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )

    const [created] = await service.dispatchEvent('domain.verified', PAYLOAD)
    await service.waitForPendingDeliveries()

    const request = calls[0]
    expect(request).toBeDefined()
    if (!request || !created) throw new Error('expected a request and delivery')

    const envelope = JSON.parse(request.body) as {
      id: string
      type: string
      created_at: string
      data: unknown
    }
    expect(envelope).toEqual({
      id: created.id,
      type: 'domain.verified',
      created_at: '2026-01-01T00:00:00.000Z',
      data: PAYLOAD,
    })

    expect(request.headers[WEBHOOK_ID_HEADER]).toBe(created.id)
    const timestamp = request.headers[WEBHOOK_TIMESTAMP_HEADER]
    expect(timestamp).toBeDefined()
    if (!timestamp) throw new Error('expected a timestamp header')
    expect(request.headers[WEBHOOK_SIGNATURE_HEADER]).toBe(
      signPayload(secret, timestamp, request.body),
    )
  })

  it('marks the delivery succeeded once the sender reports ok', async () => {
    const { repo, deliveries } = fakeRepository()
    const { sender } = fakeSender([{ ok: true, status: 200 }])
    const service = createWebhooksService(
      repo,
      sender,
      { wait: noWait },
      createFakeLogger(),
    )

    await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )
    const [created] = await service.dispatchEvent('domain.verified', PAYLOAD)
    await service.waitForPendingDeliveries()

    if (!created) throw new Error('expected a created delivery')
    const row = deliveries.get(created.id)
    expect(row?.status).toBe('succeeded')
    expect(row?.responseStatus).toBe(200)
    expect(row?.attempt).toBe(1)
    expect(row?.deliveredAt).toBeInstanceOf(Date)
  })

  it('retries on failure and eventually succeeds, bumping attempt each time', async () => {
    const { repo, deliveries } = fakeRepository()
    const { sender, calls } = fakeSender([
      { ok: false, status: 500 },
      { ok: false, status: 503 },
      { ok: true, status: 200 },
    ])
    const service = createWebhooksService(
      repo,
      sender,
      { wait: noWait, maxAttempts: 5 },
      createFakeLogger(),
    )

    await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )
    const [created] = await service.dispatchEvent('domain.verified', PAYLOAD)
    await service.waitForPendingDeliveries()

    if (!created) throw new Error('expected a created delivery')
    expect(calls).toHaveLength(3)
    const row = deliveries.get(created.id)
    expect(row?.status).toBe('succeeded')
    expect(row?.attempt).toBe(3)
    expect(row?.responseStatus).toBe(200)
  })

  it('marks failed for good once maxAttempts is exhausted', async () => {
    const { repo, deliveries } = fakeRepository()
    const { sender, calls } = fakeSender([
      { ok: false, status: 500 },
      { ok: false, status: 500 },
    ])
    const service = createWebhooksService(
      repo,
      sender,
      { wait: noWait, maxAttempts: 2 },
      createFakeLogger(),
    )

    await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )
    const [created] = await service.dispatchEvent('domain.verified', PAYLOAD)
    await service.waitForPendingDeliveries()

    if (!created) throw new Error('expected a created delivery')
    expect(calls).toHaveLength(2)
    const row = deliveries.get(created.id)
    expect(row?.status).toBe('failed')
    expect(row?.attempt).toBe(2)
    expect(row?.responseStatus).toBe(500)
  })

  it('never blocks on delivery completion — resolves even if the sender hangs', async () => {
    const { repo } = fakeRepository()
    const hangingSender: WebhookSender = {
      send: () => new Promise(() => {}),
    }
    const service = createWebhooksService(
      repo,
      hangingSender,
      {},
      createFakeLogger(),
    )

    await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )

    const outcome = await Promise.race([
      service.dispatchEvent('domain.verified', PAYLOAD).then(() => 'resolved'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
    ])

    expect(outcome).toBe('resolved')
  })
})

describe('redeliver', () => {
  it('creates a fresh delivery (new id, attempt 1) reusing the original event type and data', async () => {
    const { repo, deliveries } = fakeRepository()
    // The original delivery fails once, then succeeds on retry (2 calls);
    // the redelivery — a fresh attempt-1 row — succeeds immediately (1
    // call), for 3 total. Shows redeliver resets to attempt 1 regardless
    // of how many attempts the original needed.
    const { sender, calls } = fakeSender([
      { ok: false, status: 500 },
      { ok: true, status: 200 },
    ])
    const service = createWebhooksService(
      repo,
      sender,
      { wait: noWait },
      createFakeLogger(),
    )

    const { endpoint } = await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )
    const [original] = await service.dispatchEvent('domain.verified', PAYLOAD)
    await service.waitForPendingDeliveries()
    if (!original) throw new Error('expected an original delivery')
    expect(deliveries.get(original.id)?.attempt).toBe(2)

    const redelivered = await service.redeliver(
      'project_1',
      endpoint.id,
      original.id,
    )
    await service.waitForPendingDeliveries()

    expect(redelivered).not.toBeNull()
    expect(redelivered?.id).not.toBe(original.id)
    expect(redelivered?.attempt).toBe(1)
    expect(redelivered?.eventType).toBe('domain.verified')
    expect(calls).toHaveLength(3)

    const finalRow = deliveries.get(redelivered?.id ?? '')
    expect(finalRow?.status).toBe('succeeded')

    // The original delivery's own row is untouched by the redelivery.
    const originalRow = deliveries.get(original.id)
    expect(originalRow?.status).toBe('succeeded')
  })

  it('returns null when the delivery, endpoint, or project do not all match', async () => {
    const { repo } = fakeRepository()
    const { sender } = fakeSender([{ ok: true, status: 200 }])
    const service = createWebhooksService(
      repo,
      sender,
      { wait: noWait },
      createFakeLogger(),
    )

    const { endpoint } = await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )
    const [original] = await service.dispatchEvent('domain.verified', PAYLOAD)
    await service.waitForPendingDeliveries()
    if (!original) throw new Error('expected an original delivery')

    expect(
      await service.redeliver('project_2', endpoint.id, original.id),
    ).toBeNull()
    expect(
      await service.redeliver('project_1', randomUUID(), original.id),
    ).toBeNull()
    expect(
      await service.redeliver('project_1', endpoint.id, randomUUID()),
    ).toBeNull()
  })
})

describe('listDeliveries', () => {
  it('returns null when the endpoint does not belong to the project', async () => {
    const { repo } = fakeRepository()
    const { sender } = fakeSender([{ ok: true, status: 200 }])
    const service = createWebhooksService(
      repo,
      sender,
      { wait: noWait },
      createFakeLogger(),
    )

    const { endpoint } = await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )

    expect(
      await service.listDeliveries('project_2', endpoint.id, { limit: 10 }),
    ).toBeNull()
  })

  it('paginates and reports nextCursor until the last page', async () => {
    const { repo } = fakeRepository()
    const { sender } = fakeSender([{ ok: true, status: 200 }])
    const service = createWebhooksService(
      repo,
      sender,
      { wait: noWait },
      createFakeLogger(),
    )

    const { endpoint } = await service.createEndpoint(
      'project_1',
      'live',
      'https://example.com/hook',
      ['domain.verified'],
    )
    for (let i = 0; i < 3; i += 1) {
      await service.dispatchEvent('domain.verified', PAYLOAD)
    }
    await service.waitForPendingDeliveries()

    const firstPage = await service.listDeliveries('project_1', endpoint.id, {
      limit: 2,
    })
    expect(firstPage?.deliveries).toHaveLength(2)
    expect(firstPage?.nextCursor).not.toBeNull()

    const secondPage = await service.listDeliveries('project_1', endpoint.id, {
      limit: 2,
      cursor: firstPage?.nextCursor ?? undefined,
    })
    expect(secondPage?.deliveries).toHaveLength(1)
    expect(secondPage?.nextCursor).toBeNull()
  })
})
