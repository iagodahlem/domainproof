import type { DomainEventMap, DomainEventType, Mode } from '@shared/events'
import { decodeEventsCursor, encodeEventsCursor } from './domain/cursor'
import type {
  EventRow,
  EventsRepository,
  EventWithDomainRow,
} from './repository'

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

/**
 * A project-wide events row: `EventSummary`'s fields plus the owning
 * domain's name, and `domainId`/`mode` narrowed to non-null — every row
 * here came from `listProjectEvents`'s inner join on `domains`, so both
 * are always present (see `repository.ts`'s `listByProject`).
 */
export interface ProjectEventSummary {
  id: string
  type: string
  domainId: string
  mode: Mode
  domain: string
  payload: unknown
  createdAt: Date
}

export interface ListProjectEventsResult {
  events: ProjectEventSummary[]
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

  /**
   * A project's events across all its domains and both modes, newest
   * first, cursor-paginated — the dashboard's project-wide events table,
   * beside `listDomainEvents`'s single-domain timeline. Each row carries
   * the owning domain's name (and a non-null `mode`), since a project's
   * events table needs to render which domain a row belongs to.
   */
  listProjectEvents(
    projectId: string,
    options: { limit: number; cursor?: string },
  ): Promise<ListProjectEventsResult>
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

function toProjectSummary(row: EventWithDomainRow): ProjectEventSummary {
  return {
    id: row.id,
    type: row.type,
    // Guaranteed non-null by `listByProject`'s inner join on `domains` —
    // every domain-scoped event carries both, see `DomainEventPayload` in
    // `shared/events.ts`.
    domainId: row.domainId as string,
    mode: row.mode as Mode,
    domain: row.domain,
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

    async listProjectEvents(projectId, { limit, cursor }) {
      const decodedCursor = cursor ? decodeEventsCursor(cursor) : undefined
      const { rows, hasMore } = await repository.listByProject(projectId, {
        limit,
        cursor: decodedCursor,
      })

      const lastRow = rows[rows.length - 1]
      const nextCursor =
        hasMore && lastRow ? encodeEventsCursor({ id: lastRow.id }) : null

      return { events: rows.map(toProjectSummary), nextCursor }
    },
  }
}
