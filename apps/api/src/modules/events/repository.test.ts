import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type Database } from '@infra/db/client'
import { accounts, domains, projects } from '@infra/db/schema'
import { createEventsRepository } from './repository'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://domainproof:domainproof@localhost:5432/domainproof'

const db: Database = createDb(DATABASE_URL)
const repository = createEventsRepository(db)
const createdClerkUserIds: string[] = []

async function createTestDomain(): Promise<string> {
  const clerkUserId = `user_${randomUUID()}`
  createdClerkUserIds.push(clerkUserId)

  const [account] = await db
    .insert(accounts)
    .values({ clerkUserId })
    .returning({ id: accounts.id })
  if (!account) throw new Error('failed to create test account')

  const [project] = await db
    .insert(projects)
    .values({ accountId: account.id, name: 'Test project', slug: 'test' })
    .returning({ id: projects.id })
  if (!project) throw new Error('failed to create test project')

  const [domain] = await db
    .insert(domains)
    .values({
      projectId: project.id,
      domain: `example-${randomUUID()}.test`,
      mode: 'live',
      status: 'pending',
    })
    .returning({ id: domains.id })
  if (!domain) throw new Error('failed to create test domain')

  return domain.id
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop()
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
    }
  }
})

describe('insert', () => {
  it('persists an event with a domainId and mode', async () => {
    const domainId = await createTestDomain()

    const row = await repository.insert({
      type: 'domain.claimed',
      domainId,
      mode: 'live',
      payload: { domainId, projectId: 'p1', mode: 'live', domain: 'x.test' },
    })

    expect(row.type).toBe('domain.claimed')
    expect(row.domainId).toBe(domainId)
    expect(row.mode).toBe('live')
    expect(row.payload).toMatchObject({ domain: 'x.test' })
  })

  it('persists an event with no domainId/mode (e.g. account.created)', async () => {
    const row = await repository.insert({
      type: 'account.created',
      domainId: null,
      mode: null,
      payload: { accountId: 'a1', clerkUserId: 'u1', email: null },
    })

    expect(row.domainId).toBeNull()
    expect(row.mode).toBeNull()
  })
})

describe('listByDomain', () => {
  it('returns a domain timeline oldest first, cursor-paginated', async () => {
    const domainId = await createTestDomain()

    for (const type of [
      'domain.claimed',
      'domain.check_passed',
      'domain.verified',
    ]) {
      await repository.insert({
        type,
        domainId,
        mode: 'live',
        payload: { domainId },
      })
    }

    const firstPage = await repository.listByDomain(domainId, { limit: 2 })
    expect(firstPage.rows.map((r) => r.type)).toEqual([
      'domain.claimed',
      'domain.check_passed',
    ])
    expect(firstPage.hasMore).toBe(true)

    const lastRow = firstPage.rows[firstPage.rows.length - 1]
    if (!lastRow) throw new Error('expected a last row')

    const secondPage = await repository.listByDomain(domainId, {
      limit: 2,
      cursor: { id: lastRow.id },
    })
    expect(secondPage.rows.map((r) => r.type)).toEqual(['domain.verified'])
    expect(secondPage.hasMore).toBe(false)
  })

  it('only returns events for the requested domain', async () => {
    const domainA = await createTestDomain()
    const domainB = await createTestDomain()

    await repository.insert({
      type: 'domain.claimed',
      domainId: domainA,
      mode: 'live',
      payload: { domainId: domainA },
    })
    await repository.insert({
      type: 'domain.claimed',
      domainId: domainB,
      mode: 'live',
      payload: { domainId: domainB },
    })

    const result = await repository.listByDomain(domainA, { limit: 10 })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.domainId).toBe(domainA)
  })
})

describe('migration replaced verification_events with the generic events table', () => {
  it('verification_events no longer exists in the database', async () => {
    const result = await db.execute(
      sql`select to_regclass('public.verification_events') as regclass`,
    )
    expect(result[0]?.regclass).toBeNull()
  })

  it('events exists', async () => {
    const result = await db.execute(
      sql`select to_regclass('public.events') as regclass`,
    )
    expect(result[0]?.regclass).toBe('events')
  })
})
