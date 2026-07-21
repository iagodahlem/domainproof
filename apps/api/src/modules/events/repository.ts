import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { Database } from '@infra/db/client'
import { domains, events } from '@infra/db/schema'
import type { Mode } from '@shared/events'
import type { EventsCursor } from './domain/cursor'

export type EventRow = typeof events.$inferSelect

/**
 * An `EventRow` plus the owning domain's name, joined in from `domains` —
 * `listByProject`'s row shape. `domain` (and, in practice, `domainId`/
 * `mode`) is always present here since every row comes from an inner join
 * on `domains`: a project's events are, by definition, all domain-scoped.
 */
export interface EventWithDomainRow extends EventRow {
  domain: string
}

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

export interface ListProjectEventsOptions {
  limit: number
  cursor?: EventsCursor
}

export interface ListProjectEventsResult {
  rows: EventWithDomainRow[]
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

  /**
   * A project's events across all its domains and both modes, newest
   * first, cursor-paginated on `(created_at, id)` — the dashboard's
   * project-wide events table, beside `listByDomain`'s single-domain
   * timeline. Inner-joins `domains` (scoped to `projectId`) to pull in
   * each row's domain name, which is not itself a column on `events`.
   * Fetches `limit + 1` rows to decide `hasMore` without a second
   * round-trip, then trims back to `limit`, same as `listByDomain`.
   */
  listByProject(
    projectId: string,
    options: ListProjectEventsOptions,
  ): Promise<ListProjectEventsResult>
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

    async listByProject(projectId, { limit, cursor }) {
      // Same anchoring approach as `listByDomain` (see its comment): the
      // cursor row's own stored `(created_at, id)` is looked up server-
      // side, scoped to this project's domains so a cursor id from
      // another project's events (or one that no longer exists) just
      // yields an empty page. Newest-first here (`<` rather than `>`),
      // matching `domains/repository.ts`'s `listByProjectPaginated` —
      // the dashboard's tables read newest activity at the top, unlike a
      // single domain's oldest-first timeline.
      const cursorCondition = cursor
        ? sql`(${events.createdAt}, ${events.id}) < (
            select created_at, id from events
            where id = ${cursor.id} and domain_id in (
              select id from domains where project_id = ${projectId}
            )
          )`
        : undefined

      const rows = await db
        .select({
          id: events.id,
          type: events.type,
          domainId: events.domainId,
          mode: events.mode,
          payload: events.payload,
          createdAt: events.createdAt,
          domain: domains.domain,
        })
        .from(events)
        .innerJoin(domains, eq(events.domainId, domains.id))
        .where(
          cursorCondition
            ? and(eq(domains.projectId, projectId), cursorCondition)
            : eq(domains.projectId, projectId),
        )
        .orderBy(desc(events.createdAt), desc(events.id))
        .limit(limit + 1)

      const hasMore = rows.length > limit
      return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore }
    },
  }
}
