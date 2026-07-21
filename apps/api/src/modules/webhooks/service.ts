import { randomUUID } from 'node:crypto'
import { generateToken } from '@domainproof/core'
import type { DomainEventMap, Mode } from '@shared/events'
import type { Logger } from '@shared/logger'
import { decodeDeliveriesCursor, encodeDeliveriesCursor } from './domain/cursor'
import type { WebhookEventType } from './domain/event-types'
import {
  signPayload,
  WEBHOOK_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from './domain/signing'
import type { WebhookSender } from './ports'
import type {
  WebhookDeliveryRow,
  WebhookEndpointRow,
  WebhooksRepository,
} from './repository'

/**
 * Attempts 2+'s delay, indexed by `attempt - 2` (so `attempt: 2` waits
 * `RETRY_DELAYS_MS[0]`, etc.) — 1min, 5min, 30min, 2h. A `maxAttempts`
 * beyond this array's length + 1 just reuses the last delay rather than
 * indexing out of bounds. Fixed rather than configurable: only the total
 * attempt count is exposed as config (`WEBHOOK_MAX_ATTEMPTS`, see `env.ts`)
 * — see the module doc comment below for why a real queue, not a richer
 * backoff config, is the production answer here.
 */
const RETRY_DELAYS_MS = [
  60_000, // 1 min
  5 * 60_000, // 5 min
  30 * 60_000, // 30 min
  2 * 60 * 60_000, // 2 hours
]

const DEFAULT_MAX_ATTEMPTS = 5

/** The delay before retrying a delivery currently on `attempt`, clamped to `RETRY_DELAYS_MS`'s last entry once `attempt` runs past it. The trailing `?? 60_000` only exists to satisfy `noUncheckedIndexedAccess` — `RETRY_DELAYS_MS` is a fixed non-empty array, so it's never actually reached. */
function retryDelayMs(attempt: number): number {
  const index = Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)
  return (
    RETRY_DELAYS_MS[index] ??
    RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ??
    60_000
  )
}

export interface WebhookEndpointSummary {
  id: string
  url: string
  mode: Mode
  eventTypes: WebhookEventType[]
  /** `whsec_...<last4>` — enough to recognize the endpoint's secret, never the full value (see `createEndpoint`'s doc comment for why the secret is still stored in plaintext despite this). */
  maskedSecret: string
  disabled: boolean
  createdAt: Date
}

export interface CreateWebhookEndpointResult {
  endpoint: WebhookEndpointSummary
  /** The full `whsec_...` signing secret. Shown in full only here, at creation — every other response masks it (see `WebhookEndpointSummary.maskedSecret`). */
  secret: string
}

export interface WebhookDeliverySummary {
  id: string
  endpointId: string
  eventType: string
  attempt: number
  status: 'pending' | 'succeeded' | 'failed'
  responseStatus: number | null
  deliveredAt: Date | null
  nextRetryAt: Date | null
  createdAt: Date
}

export interface ListDeliveriesResult {
  deliveries: WebhookDeliverySummary[]
  /** `null` once the last page has been reached. */
  nextCursor: string | null
}

export interface WebhooksServiceOptions {
  /** Injected for deterministic tests; defaults to `() => new Date()`. */
  now?: () => Date
  /** Injected for tests (a fake that resolves immediately, so retry accounting can be asserted without real timers); defaults to a real `setTimeout`-backed delay. */
  wait?: (ms: number) => Promise<void>
  /** Total attempts (including the first) before a delivery is marked `failed` for good. Defaults to `env.WEBHOOK_MAX_ATTEMPTS` at the `app.ts` call site, or {@link DEFAULT_MAX_ATTEMPTS} if unset there too. */
  maxAttempts?: number
}

/**
 * Endpoint management plus the webhook dispatcher itself — a bus
 * subscriber (see `app.ts`, which registers `dispatchEvent` once per
 * `WEBHOOK_EVENT_TYPES` entry), not a route-driven use case.
 *
 * **Delivery never blocks the request that published the triggering
 * event.** `infra/events/in-process-bus.ts`'s `publish` awaits every
 * subscriber in turn, so if `dispatchEvent` awaited a delivery's full
 * HTTP round trip (let alone its retries), a slow or unreachable
 * integrator's endpoint would stall the domain-verification request that
 * triggered the event. Instead, `dispatchEvent` awaits only the fast,
 * synchronous part — creating each `webhook_deliveries` row — and fires
 * the actual HTTP attempt (`runDelivery`) in the background without
 * awaiting it. A delivery's own retry loop (`runDelivery`'s internal
 * `for (;;)`) does await `wait(delayMs)` between attempts, but that's a
 * background promise nobody's request is blocked on.
 *
 * **Retries are naive and in-process, on purpose.** A `setTimeout`-based
 * delay between attempts on the same delivery row is enough to demo
 * failure/recovery without a real queue (SQS, pg-boss, ...) — which is
 * the production-grade answer and explicitly out of scope here, same
 * tradeoff the event bus itself makes (see `shared/events.ts`). The
 * practical cost: a scheduled retry is lost if the process restarts
 * before it fires (no persisted job to resume from) — acceptable for a
 * demoable product, not for production traffic.
 */
export interface WebhooksService {
  /** Eventtypes must be a non-empty subset of `WEBHOOK_EVENT_TYPES` — validated by the route's zod schema before this is called. */
  createEndpoint(
    projectId: string,
    mode: Mode,
    url: string,
    eventTypes: WebhookEventType[],
  ): Promise<CreateWebhookEndpointResult>

  /** All endpoints (any mode, any status) belonging to a project. */
  listEndpoints(projectId: string): Promise<WebhookEndpointSummary[]>

  /** Returns the deleted endpoint, or `null` if `endpointId` doesn't belong to `projectId`. */
  deleteEndpoint(
    projectId: string,
    endpointId: string,
  ): Promise<WebhookEndpointSummary | null>

  /** Returns `null` if `endpointId` doesn't belong to `projectId`. */
  disableEndpoint(
    projectId: string,
    endpointId: string,
  ): Promise<WebhookEndpointSummary | null>

  /** Returns `null` if `endpointId` doesn't belong to `projectId`. */
  enableEndpoint(
    projectId: string,
    endpointId: string,
  ): Promise<WebhookEndpointSummary | null>

  /** An endpoint's delivery log, newest first. Returns `null` if `endpointId` doesn't belong to `projectId`. */
  listDeliveries(
    projectId: string,
    endpointId: string,
    options: { limit: number; cursor?: string },
  ): Promise<ListDeliveriesResult | null>

  /**
   * Fires a fresh delivery of a past delivery's event to the same
   * endpoint: a new delivery row (attempt 1), not a mutation of the
   * original — the original stays in the log exactly as it happened.
   * Returns `null` if `deliveryId`/`endpointId`/`projectId` don't all
   * resolve to the same relationship.
   */
  redeliver(
    projectId: string,
    endpointId: string,
    deliveryId: string,
  ): Promise<WebhookDeliverySummary | null>

  /**
   * The bus subscriber entry point. `app.ts` registers this once per
   * `WEBHOOK_EVENT_TYPES` entry:
   * `eventBus.subscribe(type, (payload) => webhooksService.dispatchEvent(type, payload))`.
   * Resolves once delivery rows are created for every subscribed, active
   * endpoint in the event's project/mode — actual HTTP delivery continues
   * in the background (see the interface doc comment above).
   */
  dispatchEvent<T extends WebhookEventType>(
    type: T,
    payload: DomainEventMap[T],
  ): Promise<WebhookDeliverySummary[]>

  /**
   * Test-only: resolves once every delivery attempt kicked off so far by
   * `dispatchEvent`/`redeliver` (including their retries) has settled.
   * Production code never calls this — the entire point of firing
   * deliveries in the background is that nothing waits on them.
   */
  waitForPendingDeliveries(): Promise<void>
}

function maskSecret(secret: string): string {
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`
}

function toEndpointSummary(row: WebhookEndpointRow): WebhookEndpointSummary {
  return {
    id: row.id,
    url: row.url,
    // See the identical narrowing comment in `infra/db/schema.ts`'s
    // `mode` column: the db guarantees a valid `Mode`/`WebhookEventType[]`,
    // but drizzle's column types erase the literal unions to plain
    // `string`/`string[]`.
    mode: row.mode as Mode,
    eventTypes: row.eventTypes as WebhookEventType[],
    maskedSecret: maskSecret(row.signingSecret),
    disabled: row.disabledAt !== null,
    createdAt: row.createdAt,
  }
}

function toDeliverySummary(row: WebhookDeliveryRow): WebhookDeliverySummary {
  return {
    id: row.id,
    endpointId: row.endpointId,
    eventType: row.eventType,
    attempt: row.attempt,
    status: row.status,
    responseStatus: row.responseStatus,
    deliveredAt: row.deliveredAt,
    nextRetryAt: row.nextRetryAt,
    createdAt: row.createdAt,
  }
}

function buildEnvelope(
  id: string,
  type: string,
  createdAt: Date,
  data: unknown,
) {
  return { id, type, created_at: createdAt.toISOString(), data }
}

const defaultWait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export function createWebhooksService(
  repository: WebhooksRepository,
  sender: WebhookSender,
  options: WebhooksServiceOptions = {},
  logger: Logger,
): WebhooksService {
  const now = options.now ?? (() => new Date())
  const wait = options.wait ?? defaultWait
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS

  // Every delivery attempt fired in the background (see the interface doc
  // comment) is tracked here so `waitForPendingDeliveries` — test-only —
  // can await them. A delivery's own retry loop lives inside one
  // `runDelivery` call (it awaits its own `wait(delayMs)` internally
  // rather than re-entering this set on each retry), so each entry here
  // resolves only once that delivery has reached a terminal state.
  const inFlight = new Set<Promise<void>>()

  function fireAndForget(promise: Promise<void>): void {
    inFlight.add(promise)
    promise
      .catch((err: unknown) => {
        logger.error({ err }, 'Webhook delivery failed unexpectedly')
      })
      .finally(() => {
        inFlight.delete(promise)
      })
  }

  async function runDelivery(
    row: WebhookDeliveryRow,
    endpoint: WebhookEndpointRow,
  ): Promise<void> {
    const body = JSON.stringify(row.payload)
    let attempt = row.attempt

    for (;;) {
      const timestamp = Math.floor(now().getTime() / 1000).toString()
      const signature = signPayload(endpoint.signingSecret, timestamp, body)

      const result = await sender.send({
        url: endpoint.url,
        body,
        headers: {
          'content-type': 'application/json',
          [WEBHOOK_ID_HEADER]: row.id,
          [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
          [WEBHOOK_SIGNATURE_HEADER]: signature,
        },
      })

      if (result.ok) {
        await repository.markSucceeded(row.id, {
          responseStatus: result.status ?? null,
          deliveredAt: now(),
        })
        return
      }

      if (attempt >= maxAttempts) {
        await repository.markFailed(row.id, {
          responseStatus: result.status ?? null,
        })
        return
      }

      const delayMs = retryDelayMs(attempt)
      const nextAttempt = attempt + 1
      await repository.markRetryScheduled(row.id, {
        attempt: nextAttempt,
        responseStatus: result.status ?? null,
        nextRetryAt: new Date(now().getTime() + delayMs),
      })
      await wait(delayMs)
      attempt = nextAttempt
    }
  }

  return {
    async createEndpoint(projectId, mode, url, eventTypes) {
      const secret = `whsec_${generateToken()}`
      const row = await repository.insertEndpoint({
        projectId,
        mode,
        url,
        signingSecret: secret,
        eventTypes,
      })
      return { endpoint: toEndpointSummary(row), secret }
    },

    async listEndpoints(projectId) {
      const rows = await repository.listEndpointsByProject(projectId)
      return rows.map(toEndpointSummary)
    },

    async deleteEndpoint(projectId, endpointId) {
      const row = await repository.deleteEndpoint(projectId, endpointId)
      return row ? toEndpointSummary(row) : null
    },

    async disableEndpoint(projectId, endpointId) {
      const row = await repository.setDisabled(projectId, endpointId, true)
      return row ? toEndpointSummary(row) : null
    },

    async enableEndpoint(projectId, endpointId) {
      const row = await repository.setDisabled(projectId, endpointId, false)
      return row ? toEndpointSummary(row) : null
    },

    async listDeliveries(projectId, endpointId, { limit, cursor }) {
      const endpoint = await repository.findEndpoint(projectId, endpointId)
      if (!endpoint) {
        return null
      }

      const decodedCursor = cursor ? decodeDeliveriesCursor(cursor) : undefined
      const { rows, hasMore } = await repository.listDeliveriesByEndpoint(
        endpointId,
        { limit, cursor: decodedCursor },
      )

      const lastRow = rows[rows.length - 1]
      const nextCursor =
        hasMore && lastRow ? encodeDeliveriesCursor({ id: lastRow.id }) : null

      return { deliveries: rows.map(toDeliverySummary), nextCursor }
    },

    async redeliver(projectId, endpointId, deliveryId) {
      const found = await repository.findDeliveryForRedeliver(
        projectId,
        endpointId,
        deliveryId,
      )
      if (!found) {
        return null
      }

      const { endpoint, delivery: original } = found
      const originalEnvelope = original.payload as { data?: unknown }
      const newId = randomUUID()
      const envelope = buildEnvelope(
        newId,
        original.eventType,
        now(),
        originalEnvelope.data,
      )

      const row = await repository.insertDelivery({
        id: newId,
        endpointId: endpoint.id,
        eventType: original.eventType,
        payload: envelope,
      })
      fireAndForget(runDelivery(row, endpoint))

      return toDeliverySummary(row)
    },

    async dispatchEvent(type, payload) {
      const endpoints = await repository.findActiveSubscribed(
        payload.projectId,
        payload.mode,
        type,
      )

      const created: WebhookDeliverySummary[] = []
      for (const endpoint of endpoints) {
        const deliveryId = randomUUID()
        const envelope = buildEnvelope(deliveryId, type, now(), payload)
        const row = await repository.insertDelivery({
          id: deliveryId,
          endpointId: endpoint.id,
          eventType: type,
          payload: envelope,
        })
        created.push(toDeliverySummary(row))
        fireAndForget(runDelivery(row, endpoint))
      }

      return created
    },

    async waitForPendingDeliveries() {
      await Promise.all(inFlight)
    },
  }
}
