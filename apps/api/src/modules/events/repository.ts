import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from '@infra/db/client'
import { events } from '@infra/db/schema'
import type { Mode } from '@shared/events'
import type { EventsCursor } from './domain/cursor'

export type EventRow = typeof events.$inferSelect

export interface EventInsert {
  type: string
  domainId: string | null
  mode: Mode | null
  payload: unknown
}

export interface ListDomainEventsOptions {
  limit: number
  cursor?: EventsCursor
}

export interface ListDomainEventsResult {
  rows: EventRow[]
  /** `true` when more rows exist past the returned page. */
  hasMore: boolean
}

/**
 * All db access for the events module — the generic `events` table. This
 * is the only file in `modules/events` allowed to import `@infra/db`.
 */
export interface EventsRepository {
  /**
   * Persists one published event, exactly once. Called from the
   * event-persistence subscriber registered first in `app.ts` for every
   * event type, so `select ... where domain_id = X order by created_at`
   * is a complete timeline regardless of which other subscribers also ran.
   */
  insert(values: EventInsert): Promise<EventRow>

  /**
   * A domain's timeline, oldest first, cursor-paginated on
   * `(created_at, id)`. Fetches `limit + 1` rows to decide `hasMore`
   * without a second round-trip, then trims back to `limit`.
   */
  listByDomain(
    domainId: string,
    options: ListDomainEventsOptions,
  ): Promise<ListDomainEventsResult>
}

export function createEventsRepository(db: Database): EventsRepository {
  return {
    async insert(values) {
      const [row] = await db
        .insert(events)
        .values({
          type: values.type,
          domainId: values.domainId,
          mode: values.mode ?? undefined,
          payload: values.payload,
        })
        .returning()

      if (!row) {
        throw new Error('Failed to persist event: insert returned no row')
      }

      return row
    },

    async listByDomain(domainId, { limit, cursor }) {
      // Anchored on the cursor row's own stored `(created_at, id)`, looked
      // up server-side in the same query, rather than a value round-
      // tripped through the JS driver (see `domain/cursor.ts`'s doc
      // comment for why that loses the precision this comparison needs).
      // Scoped to `domainId` too, so a cursor id from a different domain's
      // timeline (or one that no longer exists) can't anchor against
      // another domain's data — it just yields an empty page, same as any
      // other cursor that doesn't resolve to a row in this timeline.
      const cursorCondition = cursor
        ? sql`(${events.createdAt}, ${events.id}) > (
            select created_at, id from events
            where id = ${cursor.id} and domain_id = ${domainId}
          )`
        : undefined

      const rows = await db
        .select()
        .from(events)
        .where(
          cursorCondition
            ? and(eq(events.domainId, domainId), cursorCondition)
            : eq(events.domainId, domainId),
        )
        .orderBy(asc(events.createdAt), asc(events.id))
        .limit(limit + 1)

      const hasMore = rows.length > limit
      return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore }
    },
  }
}
