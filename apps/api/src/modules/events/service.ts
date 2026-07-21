import type { DomainEventMap, DomainEventType, Mode } from '@shared/events'
import { decodeEventsCursor, encodeEventsCursor } from './domain/cursor'
import type { EventRow, EventsRepository } from './repository'

export interface EventSummary {
  id: string
  type: string
  domainId: string | null
  mode: Mode | null
  payload: unknown
  createdAt: Date
}

export interface ListDomainEventsResult {
  events: EventSummary[]
  /** `null` once the last page has been reached. */
  nextCursor: string | null
}

export interface EventsService {
  /**
   * Persists one published event. This is the function `app.ts` registers
   * as the *first* subscriber for every event type (see
   * `DOMAIN_EVENT_TYPES` in `shared/events.ts`) — every other subscriber
   * (email, ...) runs after this one, so the events table is a guaranteed,
   * complete record regardless of what else reacts to the event.
   */
  record(
    type: DomainEventType,
    payload: DomainEventMap[DomainEventType],
  ): Promise<void>

  /** A domain's timeline, oldest first, cursor-paginated. */
  listDomainEvents(
    domainId: string,
    options: { limit: number; cursor?: string },
  ): Promise<ListDomainEventsResult>
}

function toSummary(row: EventRow): EventSummary {
  return {
    id: row.id,
    type: row.type,
    domainId: row.domainId,
    // See the identical narrowing comment in `infra/db/schema.ts`'s
    // `events` table: the enum column is guaranteed a valid `Mode` (or
    // null) by the db, but drizzle's `pgEnum` cast erases the literal
    // union to plain `string`.
    mode: row.mode as Mode | null,
    payload: row.payload,
    createdAt: row.createdAt,
  }
}

export function createEventsService(
  repository: EventsRepository,
): EventsService {
  return {
    async record(type, payload) {
      const domainId = 'domainId' in payload ? payload.domainId : null
      const mode = 'mode' in payload ? payload.mode : null
      await repository.insert({ type, domainId, mode, payload })
    },

    async listDomainEvents(domainId, { limit, cursor }) {
      const decodedCursor = cursor ? decodeEventsCursor(cursor) : undefined
      const { rows, hasMore } = await repository.listByDomain(domainId, {
        limit,
        cursor: decodedCursor,
      })

      const lastRow = rows[rows.length - 1]
      const nextCursor =
        hasMore && lastRow ? encodeEventsCursor({ id: lastRow.id }) : null

      return { events: rows.map(toSummary), nextCursor }
    },
  }
}
