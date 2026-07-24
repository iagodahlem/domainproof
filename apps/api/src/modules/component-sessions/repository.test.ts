import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type Database } from '@infra/db/client'
import { accounts, projects } from '@infra/db/schema'
import { createComponentSessionsRepository } from './repository'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://domainproof:domainproof@localhost:5432/domainproof'

const db: Database = createDb(DATABASE_URL)
const repository = createComponentSessionsRepository(db)
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
      slug: `test-${randomUUID().slice(0, 8)}`,
    })
    .returning({ id: projects.id })
  if (!project) throw new Error('failed to create test project')

  return project.id
}

function sessionValues(
  projectId: string,
  overrides: Partial<{
    mode: 'test' | 'live'
    externalId: string
    token: string
    expiresAt: Date
  }> = {},
) {
  return {
    projectId,
    mode: overrides.mode ?? ('test' as const),
    externalId: overrides.externalId,
    token: overrides.token ?? `session-token-${randomUUID()}`,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
  }
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop()
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
    }
  }
})

describe('create', () => {
  it('persists a session with the given project, mode, and externalId', async () => {
    const projectId = await createTestProject()
    const token = `session-token-${randomUUID()}`

    const row = await repository.create(
      sessionValues(projectId, { mode: 'live', externalId: 'user_123', token }),
    )

    expect(row.projectId).toBe(projectId)
    expect(row.mode).toBe('live')
    expect(row.externalId).toBe('user_123')
    expect(row.token).toBe(token)
    expect(row.consumedAt).toBeNull()
  })

  it('defaults externalId to null when not given', async () => {
    const projectId = await createTestProject()

    const row = await repository.create(sessionValues(projectId))

    expect(row.externalId).toBeNull()
  })
})

describe('consumeIfAvailable', () => {
  it('marks an unconsumed, unexpired session consumed and returns it', async () => {
    const projectId = await createTestProject()
    const token = `session-token-${randomUUID()}`
    await repository.create(sessionValues(projectId, { token }))

    const now = new Date()
    const row = await repository.consumeIfAvailable(token, now)

    expect(row).toBeDefined()
    expect(row?.token).toBe(token)
    expect(row?.consumedAt?.getTime()).toBe(now.getTime())
  })

  it('returns undefined for an unknown token', async () => {
    const row = await repository.consumeIfAvailable(
      `unknown-token-${randomUUID()}`,
      new Date(),
    )
    expect(row).toBeUndefined()
  })

  it('returns undefined for an already-consumed session, and never re-consumes it', async () => {
    const projectId = await createTestProject()
    const token = `session-token-${randomUUID()}`
    await repository.create(sessionValues(projectId, { token }))

    const first = await repository.consumeIfAvailable(token, new Date())
    expect(first).toBeDefined()

    const second = await repository.consumeIfAvailable(token, new Date())
    expect(second).toBeUndefined()
  })

  it('returns undefined for an expired session', async () => {
    const projectId = await createTestProject()
    const token = `session-token-${randomUUID()}`
    await repository.create(
      sessionValues(projectId, {
        token,
        expiresAt: new Date(Date.now() - 1000),
      }),
    )

    const row = await repository.consumeIfAvailable(token, new Date())
    expect(row).toBeUndefined()
  })

  it('treats exactly-at-expiry as expired', async () => {
    const projectId = await createTestProject()
    const token = `session-token-${randomUUID()}`
    const expiresAt = new Date(Date.now() + 60_000)
    await repository.create(sessionValues(projectId, { token, expiresAt }))

    const row = await repository.consumeIfAvailable(token, expiresAt)
    expect(row).toBeUndefined()
  })
})
