import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type {
  EventInsert,
  EventRow,
  EventsRepository,
  EventWithDomainRow,
  ListDomainEventsOptions,
  ListProjectEventsOptions,
} from './repository'
import { encodeEventsCursor } from './domain/cursor'
import { createEventsService } from './service'

/**
 * A fake `EventsRepository` implementing the port in memory — no real db.
 * The repository's own persistence/cursor-query correctness is covered by
 * repository.test.ts against a real db; this file only tests the service's
 * orchestration (domain/mode extraction, cursor encode/decode).
 *
 * `listByProject` stands in for the real repository's join against
 * `domains` (see `repository.ts`) by reading `projectId`/`domain` straight
 * off each event's own payload — every domain-scoped `DomainEventMap`
 * payload carries both (see `shared/events.ts`'s `DomainEventPayload`), so
 * no separate domains table needs faking here.
 */
function fakeRepository(seed: EventRow[] = []): EventsRepository {
  const rows = [...seed]

  function payloadField(payload: unknown, field: string): string | undefined {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !(field in payload)
    ) {
      return undefined
    }
    const value = (payload as Record<string, unknown>)[field]
    return typeof value === 'string' ? value : undefined
  }

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

    async listByProject(projectId: string, options: ListProjectEventsOptions) {
      // Newest-first, the inverse of `listByDomain`'s chronological
      // insertion order.
      const matching: EventWithDomainRow[] = rows
        .filter((row) => payloadField(row.payload, 'projectId') === projectId)
        .map((row) => ({
          ...row,
          domain: payloadField(row.payload, 'domain') ?? '',
        }))
        .reverse()

      const anchorIndex = options.cursor
        ? matching.findIndex((row) => row.id === options.cursor?.id)
        : -1
      const startIndex = options.cursor ? anchorIndex + 1 : 0
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

describe('listProjectEvents', () => {
  it("lists events across a project's domains, newest first, with domain/mode per row", async () => {
    const repository = fakeRepository()
    const service = createEventsService(repository)

    await service.record('domain.claimed', {
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'live',
      domain: 'a.com',
    })
    await service.record('domain.claimed', {
      domainId: 'domain_2',
      projectId: 'project_1',
      mode: 'test',
      domain: 'b.com',
    })
    await service.record('domain.verified', {
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'live',
      domain: 'a.com',
    })

    const { events } = await service.listProjectEvents('project_1', {
      limit: 10,
    })
    expect(events.map((e) => e.type)).toEqual([
      'domain.verified',
      'domain.claimed',
      'domain.claimed',
    ])
    expect(events.map((e) => e.domain)).toEqual(['a.com', 'b.com', 'a.com'])
    expect(events.map((e) => e.mode)).toEqual(['live', 'test', 'live'])
    expect(events.map((e) => e.domainId)).toEqual([
      'domain_1',
      'domain_2',
      'domain_1',
    ])
  })

  it("only returns events for the requested project's domains", async () => {
    const repository = fakeRepository()
    const service = createEventsService(repository)

    await service.record('domain.claimed', {
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'live',
      domain: 'a.com',
    })
    await service.record('domain.claimed', {
      domainId: 'domain_2',
      projectId: 'project_2',
      mode: 'live',
      domain: 'b.com',
    })

    const { events } = await service.listProjectEvents('project_1', {
      limit: 10,
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.domain).toBe('a.com')
  })

  it('paginates with a cursor and reports nextCursor until the last page', async () => {
    const repository = fakeRepository()
    const service = createEventsService(repository)

    for (let i = 0; i < 3; i += 1) {
      await service.record('domain.check_passed', {
        domainId: 'domain_1',
        projectId: 'project_1',
        mode: 'live',
        domain: 'a.com',
      })
    }

    const firstPage = await service.listProjectEvents('project_1', {
      limit: 2,
    })
    expect(firstPage.events).toHaveLength(2)
    expect(firstPage.nextCursor).not.toBeNull()

    const secondPage = await service.listProjectEvents('project_1', {
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    })
    expect(secondPage.events).toHaveLength(1)
    expect(secondPage.nextCursor).toBeNull()
  })

  it('returns an empty page for a project with no events', async () => {
    const repository = fakeRepository()
    const service = createEventsService(repository)

    const result = await service.listProjectEvents('project_1', { limit: 10 })
    expect(result.events).toEqual([])
    expect(result.nextCursor).toBeNull()
  })
})
