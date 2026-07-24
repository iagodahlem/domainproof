import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type Database } from '@infra/db/client'
import { accounts } from '@infra/db/schema'
import {
  createProjectsRepository,
  type ProjectApiKeyInsert,
} from './repository'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://domainproof:domainproof@localhost:5432/domainproof'

const db: Database = createDb(DATABASE_URL)
const repository = createProjectsRepository(db)
const createdClerkUserIds: string[] = []

async function createTestAccount(): Promise<string> {
  const clerkUserId = `user_${randomUUID()}`
  createdClerkUserIds.push(clerkUserId)

  const [account] = await db
    .insert(accounts)
    .values({ clerkUserId })
    .returning({ id: accounts.id })
  if (!account) throw new Error('failed to create test account')
  return account.id
}

// A real, globally unique keyId (this test runs against a real db, and
// `api_keys.key_id` carries a real unique constraint shared with every
// other test file's rows) — a random UUID fragment rather than a fixed
// suffix avoids collisions with other test files' own key material.
function keyMaterial(mode: 'test' | 'live'): ProjectApiKeyInsert {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  return {
    mode,
    keyId: suffix,
    secretHash: `hash-${suffix}`,
    last4: suffix.slice(-4),
    name: null,
  }
}

// Same reasoning as `keyMaterial` above, now that `projects.slug` also
// carries a real unique constraint: a fixed literal like 'skylane-hr' would
// collide with this same file's other tests running concurrently, or with
// another test file's own fixed literal (see `apis/dashboard/routes/
// projects.test.ts`'s "Skylane HR").
function uniqueSlug(base: string): string {
  return `${base}-${randomUUID().slice(0, 8)}`
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop()
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
    }
  }
})

describe('listByAccountId', () => {
  it('returns an empty list for an account with no projects', async () => {
    const accountId = await createTestAccount()
    expect(await repository.listByAccountId(accountId)).toEqual([])
  })

  it("returns only the given account's projects", async () => {
    const accountA = await createTestAccount()
    const accountB = await createTestAccount()

    await repository.createProject(
      accountA,
      'Project A',
      uniqueSlug('project-a'),
      [keyMaterial('test'), keyMaterial('live')],
    )
    await repository.createProject(
      accountB,
      'Project B',
      uniqueSlug('project-b'),
      [keyMaterial('test'), keyMaterial('live')],
    )

    const rowsA = await repository.listByAccountId(accountA)
    expect(rowsA).toHaveLength(1)
    expect(rowsA[0]?.name).toBe('Project A')

    const rowsB = await repository.listByAccountId(accountB)
    expect(rowsB).toHaveLength(1)
    expect(rowsB[0]?.name).toBe('Project B')
  })
})

describe('findByIdForAccount', () => {
  it('returns undefined for an unknown project id', async () => {
    const accountId = await createTestAccount()
    expect(
      await repository.findByIdForAccount(randomUUID(), accountId),
    ).toBeUndefined()
  })

  it('returns undefined for a project that belongs to a different account', async () => {
    const owner = await createTestAccount()
    const other = await createTestAccount()

    const created = await repository.createProject(
      owner,
      'Owner project',
      uniqueSlug('owner-project'),
      [keyMaterial('test'), keyMaterial('live')],
    )
    if (!created) throw new Error('setup failed')

    expect(
      await repository.findByIdForAccount(created.project.id, other),
    ).toBeUndefined()
  })

  it('returns the project when it belongs to the given account', async () => {
    const accountId = await createTestAccount()
    const slug = uniqueSlug('skylane-hr')
    const created = await repository.createProject(
      accountId,
      'Skylane HR',
      slug,
      [keyMaterial('test'), keyMaterial('live')],
    )
    if (!created) throw new Error('setup failed')

    const found = await repository.findByIdForAccount(
      created.project.id,
      accountId,
    )
    expect(found?.id).toBe(created.project.id)
    expect(found?.slug).toBe(slug)
  })
})

describe('findSlugById', () => {
  it('returns undefined for an unknown project id', async () => {
    expect(await repository.findSlugById(randomUUID())).toBeUndefined()
  })

  it("returns the project's slug", async () => {
    const accountId = await createTestAccount()
    const slug = uniqueSlug('skylane-hr')
    const created = await repository.createProject(
      accountId,
      'Skylane HR',
      slug,
      [keyMaterial('test'), keyMaterial('live')],
    )
    if (!created) throw new Error('setup failed')

    expect(await repository.findSlugById(created.project.id)).toBe(slug)
  })
})

describe('findNameById', () => {
  it('returns undefined for an unknown project id', async () => {
    expect(await repository.findNameById(randomUUID())).toBeUndefined()
  })

  it("returns the project's display name", async () => {
    const accountId = await createTestAccount()
    const created = await repository.createProject(
      accountId,
      'Skylane HR',
      uniqueSlug('skylane-hr'),
      [keyMaterial('test'), keyMaterial('live')],
    )
    if (!created) throw new Error('setup failed')

    expect(await repository.findNameById(created.project.id)).toBe('Skylane HR')
  })
})

describe('updateName', () => {
  it('returns undefined for an unknown project id', async () => {
    expect(
      await repository.updateName(randomUUID(), 'New Name'),
    ).toBeUndefined()
  })

  it('updates the name without touching the slug', async () => {
    const accountId = await createTestAccount()
    const slug = uniqueSlug('skylane-hr')
    const created = await repository.createProject(
      accountId,
      'Skylane HR',
      slug,
      [keyMaterial('test'), keyMaterial('live')],
    )
    if (!created) throw new Error('setup failed')

    const updated = await repository.updateName(
      created.project.id,
      'Skylane People',
    )
    expect(updated?.name).toBe('Skylane People')
    expect(updated?.slug).toBe(slug)

    const reread = await repository.findByIdForAccount(
      created.project.id,
      accountId,
    )
    expect(reread?.name).toBe('Skylane People')
    expect(reread?.slug).toBe(slug)
  })
})

describe('createProject', () => {
  it('creates a project and both of its keys atomically', async () => {
    const accountId = await createTestAccount()
    const slug = uniqueSlug('skylane-hr')

    const result = await repository.createProject(
      accountId,
      'Skylane HR',
      slug,
      [keyMaterial('test'), keyMaterial('live')],
    )
    if (!result) throw new Error('setup failed')

    expect(result.project.name).toBe('Skylane HR')
    expect(result.project.slug).toBe(slug)
    expect(result.project.accountId).toBe(accountId)

    expect(result.apiKeys).toHaveLength(2)
    const modes = result.apiKeys.map((key) => key.mode).sort()
    expect(modes).toEqual(['live', 'test'])
    for (const key of result.apiKeys) {
      expect(key.projectId).toBe(result.project.id)
      expect(key.revokedAt).toBeNull()
    }
  })

  it('allows a second project for the same account (no name/account dedup guard)', async () => {
    const accountId = await createTestAccount()

    await repository.createProject(accountId, 'First', uniqueSlug('first'), [
      keyMaterial('test'),
      keyMaterial('live'),
    ])
    await repository.createProject(accountId, 'Second', uniqueSlug('second'), [
      keyMaterial('test'),
      keyMaterial('live'),
    ])

    expect(await repository.listByAccountId(accountId)).toHaveLength(2)
  })

  it('returns undefined and inserts nothing when the slug is already taken', async () => {
    const accountA = await createTestAccount()
    const accountB = await createTestAccount()
    const slug = uniqueSlug('taken')

    const first = await repository.createProject(accountA, 'First', slug, [
      keyMaterial('test'),
      keyMaterial('live'),
    ])
    if (!first) throw new Error('setup failed')

    const second = await repository.createProject(accountB, 'Second', slug, [
      keyMaterial('test'),
      keyMaterial('live'),
    ])

    expect(second).toBeUndefined()
    expect(await repository.listByAccountId(accountB)).toEqual([])
  })
})
