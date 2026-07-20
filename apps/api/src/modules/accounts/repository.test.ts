import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type Database } from '@infra/db/client'
import { accounts, projects } from '@infra/db/schema'
import { createAccountsRepository } from './repository'

// Runs against the postgres service defined in the repo's compose.yaml
// (started with `docker compose up -d db` and migrated with
// `pnpm --filter api db:migrate`) rather than mocking the db layer, so the
// ON CONFLICT DO NOTHING + re-select concurrency behavior is exercised
// against a real unique constraint instead of a stubbed one.
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://domainproof:domainproof@localhost:5432/domainproof'

const db: Database = createDb(DATABASE_URL)
const repository = createAccountsRepository(db)
const createdClerkUserIds: string[] = []

function freshClerkUserId() {
  const id = `user_${randomUUID()}`
  createdClerkUserIds.push(id)
  return id
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop()
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
    }
  }
})

describe('createWithDefaultProject', () => {
  it('creates an account and a default project for a new clerk user', async () => {
    const clerkUserId = freshClerkUserId()

    const created = await repository.createWithDefaultProject(clerkUserId)
    expect(created).toBeDefined()

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.clerkUserId, clerkUserId))
    expect(account?.id).toBe(created?.id)

    const projectRows = await db
      .select()
      .from(projects)
      .where(eq(projects.accountId, created?.id ?? ''))
    expect(projectRows).toHaveLength(1)
    expect(projectRows[0]?.name).toBe('Default')
    expect(projectRows[0]?.slug).toBe('default')
  })

  it('returns undefined without creating a second project when the account already exists', async () => {
    const clerkUserId = freshClerkUserId()

    const first = await repository.createWithDefaultProject(clerkUserId)
    const second = await repository.createWithDefaultProject(clerkUserId)

    expect(first).toBeDefined()
    expect(second).toBeUndefined()

    const projectRows = await db
      .select()
      .from(projects)
      .where(eq(projects.accountId, first?.id ?? ''))
    expect(projectRows).toHaveLength(1)
  })

  it('is safe under concurrent calls for the same user: exactly one create wins', async () => {
    const clerkUserId = freshClerkUserId()

    const [a, b, c] = await Promise.all([
      repository.createWithDefaultProject(clerkUserId),
      repository.createWithDefaultProject(clerkUserId),
      repository.createWithDefaultProject(clerkUserId),
    ])

    const results = [a, b, c]
    expect(results.filter((r) => r !== undefined)).toHaveLength(1)

    const winner = results.find((r) => r !== undefined)
    const projectRows = await db
      .select()
      .from(projects)
      .where(eq(projects.accountId, winner?.id ?? ''))
    expect(projectRows).toHaveLength(1)
  })
})

describe('findByClerkUserId', () => {
  it('returns undefined for a clerk user id with no account', async () => {
    expect(
      await repository.findByClerkUserId(`user_${randomUUID()}`),
    ).toBeUndefined()
  })

  it("returns the account row after it's created", async () => {
    const clerkUserId = freshClerkUserId()
    const created = await repository.createWithDefaultProject(clerkUserId)

    const found = await repository.findByClerkUserId(clerkUserId)
    expect(found?.id).toBe(created?.id)
  })
})
