import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type Database } from '@infra/db/client'
import { accounts, projects } from '@infra/db/schema'
import { uniqueSlug } from '@shared/testing/unique-slug'
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

describe('create', () => {
  it('creates an account with no project', async () => {
    const clerkUserId = freshClerkUserId()

    const created = await repository.create(clerkUserId, null)
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
    expect(projectRows).toHaveLength(0)
  })

  it('returns undefined when the account already exists', async () => {
    const clerkUserId = freshClerkUserId()

    const first = await repository.create(clerkUserId, null)
    const second = await repository.create(clerkUserId, null)

    expect(first).toBeDefined()
    expect(second).toBeUndefined()
  })

  it('is safe under concurrent calls for the same user: exactly one create wins', async () => {
    const clerkUserId = freshClerkUserId()

    const [a, b, c] = await Promise.all([
      repository.create(clerkUserId, null),
      repository.create(clerkUserId, null),
      repository.create(clerkUserId, null),
    ])

    const results = [a, b, c]
    expect(results.filter((r) => r !== undefined)).toHaveLength(1)
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
    const created = await repository.create(clerkUserId, null)

    const found = await repository.findByClerkUserId(clerkUserId)
    expect(found?.id).toBe(created?.id)
  })

  it('persists the email a caller provides at creation', async () => {
    const clerkUserId = freshClerkUserId()
    const created = await repository.create(clerkUserId, 'builder@example.com')
    expect(created?.email).toBe('builder@example.com')

    const found = await repository.findByClerkUserId(clerkUserId)
    expect(found?.email).toBe('builder@example.com')
  })
})

describe('updateEmail', () => {
  it('sets the email on the account row', async () => {
    const clerkUserId = freshClerkUserId()
    const created = await repository.create(clerkUserId, null)
    if (!created) throw new Error('setup failed')

    await repository.updateEmail(created.id, 'backfilled@example.com')

    const found = await repository.findByClerkUserId(clerkUserId)
    expect(found?.email).toBe('backfilled@example.com')
  })

  it('overwrites a previous email when called again', async () => {
    const clerkUserId = freshClerkUserId()
    const created = await repository.create(clerkUserId, 'first@example.com')
    if (!created) throw new Error('setup failed')

    await repository.updateEmail(created.id, 'second@example.com')

    const found = await repository.findByClerkUserId(clerkUserId)
    expect(found?.email).toBe('second@example.com')
  })
})

describe('findEmailByProjectId', () => {
  it("returns the owning account's email", async () => {
    const clerkUserId = freshClerkUserId()
    const created = await repository.create(clerkUserId, 'builder@example.com')
    if (!created) throw new Error('setup failed')

    const [project] = await db
      .insert(projects)
      .values({
        accountId: created.id,
        name: 'Test project',
        slug: uniqueSlug('test-project'),
      })
      .returning({ id: projects.id })
    if (!project) throw new Error('setup failed: could not create test project')

    expect(await repository.findEmailByProjectId(project.id)).toBe(
      'builder@example.com',
    )
  })

  it('returns undefined for an unknown project id', async () => {
    expect(await repository.findEmailByProjectId(randomUUID())).toBeUndefined()
  })

  it('returns undefined when the owning account has no email on file', async () => {
    const clerkUserId = freshClerkUserId()
    const created = await repository.create(clerkUserId, null)
    if (!created) throw new Error('setup failed')

    const [project] = await db
      .insert(projects)
      .values({
        accountId: created.id,
        name: 'Test project',
        slug: uniqueSlug('test-project'),
      })
      .returning({ id: projects.id })
    if (!project) throw new Error('setup failed: could not create test project')

    expect(await repository.findEmailByProjectId(project.id)).toBeUndefined()
  })
})
