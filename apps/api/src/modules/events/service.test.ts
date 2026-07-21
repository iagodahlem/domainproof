import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type {
  EventInsert,
  EventRow,
  EventsRepository,
  ListDomainEventsOptions,
} from './repository'
import { encodeEventsCursor } from './domain/cursor'
import { createEventsService } from './service'

/**
 * A fake `EventsRepository` implementing the port in memory — no real db.
 * The repository's own persistence/cursor-query correctness is covered by
 * repository.test.ts against a real db; this file only tests the service's
 * orchestration (domain/mode extraction, cursor encode/decode).
 */
function fakeRepository(seed: EventRow[] = []): EventsRepository {
  const rows = [...seed]

  return {
    async insert(values: EventInsert) {
      const row: EventRow = {
        id: randomUUID(),
        type: values.type,
        domainId: values.domainId,
        mode: values.mode,
        payload: values.payload,
        createdAt: new Date(),
      }
      rows.push(row)
      return row
    },

    async listByDomain(domainId: string, options: ListDomainEventsOptions) {
      // Insertion order is already chronological here (no lossy db
      // round-trip to worry about, unlike the real repository — see
      // `domain/cursor.ts`), so the cursor just resolves to "everything
      // after this row's position in this domain's timeline".
      const matching = rows.filter((row) => row.domainId === domainId)

      const anchorIndex = options.cursor
        ? matching.findIndex((row) => row.id === options.cursor?.id)
        : -1
      const startIndex = options.cursor ? anchorIndex + 1 : 0
      // A cursor that doesn't resolve to a row in this domain's timeline
      // (garbage id, or one from a different domain) yields no results —
      // same as the real repository's subquery-anchored comparison.
      if (options.cursor && anchorIndex === -1) {
        return { rows: [], hasMore: false }
      }

      const remaining = matching.slice(startIndex)
      const hasMore = remaining.length > options.limit
      return {
        rows: hasMore ? remaining.slice(0, options.limit) : remaining,
        hasMore,
      }
    },
  }
}

describe('record', () => {
  it('extracts domainId and mode from a domain-scoped payload', async () => {
    const repository = fakeRepository()
    const service = createEventsService(repository)

    await service.record('domain.verified', {
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'test',
      domain: 'example.com',
    })

    const { events } = await service.listDomainEvents('domain_1', {
      limit: 10,
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'domain.verified',
      domainId: 'domain_1',
      mode: 'test',
    })
  })

  it('stores null domainId/mode for an account-scoped payload', async () => {
    const repository = fakeRepository()
    const service = createEventsService(repository)

    await service.record('account.created', {
      accountId: 'account_1',
      clerkUserId: 'user_1',
      email: 'builder@example.com',
    })

    const inserted = await repository.listByDomain('nonexistent', {
      limit: 10,
    })
    expect(inserted.rows).toHaveLength(0)
  })
})

describe('listDomainEvents', () => {
  it('paginates with a cursor and reports nextCursor until the last page', async () => {
    const repository = fakeRepository()
    const service = createEventsService(repository)

    for (let i = 0; i < 3; i += 1) {
      await service.record('domain.check_passed', {
        domainId: 'domain_1',
        projectId: 'project_1',
        mode: 'live',
        domain: 'example.com',
      })
    }

    const firstPage = await service.listDomainEvents('domain_1', { limit: 2 })
    expect(firstPage.events).toHaveLength(2)
    expect(firstPage.nextCursor).not.toBeNull()

    const secondPage = await service.listDomainEvents('domain_1', {
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    })
    expect(secondPage.events).toHaveLength(1)
    expect(secondPage.nextCursor).toBeNull()
  })

  it('treats an invalid cursor as "start from the beginning"', async () => {
    const repository = fakeRepository()
    const service = createEventsService(repository)

    await service.record('domain.verified', {
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'test',
      domain: 'example.com',
    })

    const result = await service.listDomainEvents('domain_1', {
      limit: 10,
      cursor: 'garbage',
    })
    expect(result.events).toHaveLength(1)
  })

  it('a well-formed cursor that resolves to no row yields no events', async () => {
    const repository = fakeRepository()
    const service = createEventsService(repository)

    await service.record('domain.verified', {
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'test',
      domain: 'example.com',
    })

    const unresolvableCursor = encodeEventsCursor({
      id: 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',
    })

    const result = await service.listDomainEvents('domain_1', {
      limit: 10,
      cursor: unresolvableCursor,
    })
    expect(result.events).toHaveLength(0)
  })
})
