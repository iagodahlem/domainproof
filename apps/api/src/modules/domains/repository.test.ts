import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type Database } from '@infra/db/client'
import { accounts, challenges, domains, projects } from '@infra/db/schema'
import { createDomainsRepository } from './repository'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://domainproof:domainproof@localhost:5432/domainproof'

const db: Database = createDb(DATABASE_URL)
const repository = createDomainsRepository(db)
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
    .values({ accountId: account.id, name: 'Test project', slug: 'test' })
    .returning({ id: projects.id })
  if (!project) throw new Error('failed to create test project')

  return project.id
}

function claimValues(
  projectId: string,
  overrides: Partial<{
    domain: string
    mode: 'test' | 'live'
  }> = {},
) {
  return {
    projectId,
    mode: overrides.mode ?? ('live' as const),
    domain: overrides.domain ?? `example-${randomUUID()}.test`,
    status: 'pending' as const,
    nextCheckAt: new Date(Date.now() + 60_000),
    challenge: {
      method: 'dns_txt' as const,
      token: `token-${randomUUID()}`,
      recordHost: '_test-challenge.example.test',
      recordValue: 'test-verify=abc123',
      expiresAt: new Date(Date.now() + 60_000),
    },
  }
}

function attemptValues(
  domainId: string,
  overrides: Partial<{
    nextStatus: 'pending' | 'verified' | 'temporarily_failed' | 'failed'
    verifiedAt: Date
    nextCheckAt: Date | null
    checkAttempts: number
    graceExpiresAt: Date | null
  }> = {},
) {
  return {
    domainId,
    nextStatus: overrides.nextStatus ?? ('pending' as const),
    checkedAt: new Date(),
    nextCheckAt:
      overrides.nextCheckAt === undefined
        ? new Date(Date.now() + 60_000)
        : overrides.nextCheckAt,
    checkAttempts: overrides.checkAttempts ?? 0,
    ...(overrides.verifiedAt ? { verifiedAt: overrides.verifiedAt } : {}),
    ...(overrides.graceExpiresAt !== undefined
      ? { graceExpiresAt: overrides.graceExpiresAt }
      : {}),
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

describe('claim', () => {
  it('persists a domain and its challenge', async () => {
    const projectId = await createTestProject()
    const domain = `example-${randomUUID()}.test`

    const result = await repository.claim(claimValues(projectId, { domain }))

    expect(result).toBeDefined()
    if (!result) return

    expect(result.domain.projectId).toBe(projectId)
    expect(result.domain.domain).toBe(domain)
    expect(result.domain.status).toBe('pending')
    expect(result.challenge.domainId).toBe(result.domain.id)
    expect(result.challenge.recordHost).toBe('_test-challenge.example.test')
  })

  it('returns undefined on a (project, domain, mode) conflict', async () => {
    const projectId = await createTestProject()
    const domain = `example-${randomUUID()}.test`

    const first = await repository.claim(claimValues(projectId, { domain }))
    expect(first).toBeDefined()

    const second = await repository.claim(claimValues(projectId, { domain }))
    expect(second).toBeUndefined()

    const rows = await repository.listByProject(projectId, 'live')
    expect(rows).toHaveLength(1)
  })

  it('allows the same domain to be claimed by a different project', async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()
    const domain = `example-${randomUUID()}.test`

    const first = await repository.claim(claimValues(projectA, { domain }))
    const second = await repository.claim(claimValues(projectB, { domain }))

    expect(first).toBeDefined()
    expect(second).toBeDefined()
  })

  it('allows the same domain to be claimed twice under different modes', async () => {
    const projectId = await createTestProject()
    const domain = `example-${randomUUID()}.test`

    const live = await repository.claim(
      claimValues(projectId, { domain, mode: 'live' }),
    )
    const test = await repository.claim(
      claimValues(projectId, { domain, mode: 'test' }),
    )

    expect(live).toBeDefined()
    expect(test).toBeDefined()
  })
})

describe('listByProject', () => {
  it('only returns domains for the given project and mode', async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()

    await repository.claim(claimValues(projectA, { mode: 'live' }))
    await repository.claim(claimValues(projectA, { mode: 'test' }))
    await repository.claim(claimValues(projectB, { mode: 'live' }))

    expect(await repository.listByProject(projectA, 'live')).toHaveLength(1)
    expect(await repository.listByProject(projectA, 'test')).toHaveLength(1)
    expect(await repository.listByProject(projectB, 'live')).toHaveLength(1)
    expect(await repository.listByProject(projectB, 'test')).toHaveLength(0)
  })
})

describe('listByProjectPaginated', () => {
  it('returns domains for the project only, newest first, paginated', async () => {
    const projectId = await createTestProject()
    const otherProjectId = await createTestProject()

    const first = await repository.claim(
      claimValues(projectId, { domain: 'first.test' }),
    )
    const second = await repository.claim(
      claimValues(projectId, { domain: 'second.test' }),
    )
    const third = await repository.claim(
      claimValues(projectId, { domain: 'third.test' }),
    )
    await repository.claim(
      claimValues(otherProjectId, { domain: 'other.test' }),
    )
    if (!first || !second || !third) throw new Error('setup failed')

    const firstPage = await repository.listByProjectPaginated(projectId, {
      limit: 2,
    })
    expect(firstPage.rows.map((r) => r.domain)).toEqual([
      'third.test',
      'second.test',
    ])
    expect(firstPage.hasMore).toBe(true)

    const lastRow = firstPage.rows[firstPage.rows.length - 1]
    if (!lastRow) throw new Error('expected a last row')

    const secondPage = await repository.listByProjectPaginated(projectId, {
      limit: 2,
      cursor: { id: lastRow.id },
    })
    expect(secondPage.rows.map((r) => r.domain)).toEqual(['first.test'])
    expect(secondPage.hasMore).toBe(false)
  })

  it('includes domains across both modes', async () => {
    const projectId = await createTestProject()
    await repository.claim(claimValues(projectId, { mode: 'live' }))
    await repository.claim(claimValues(projectId, { mode: 'test' }))

    const { rows } = await repository.listByProjectPaginated(projectId, {
      limit: 10,
    })
    expect(rows).toHaveLength(2)
  })

  it('returns an empty page for a project with no domains', async () => {
    const projectId = await createTestProject()

    const { rows, hasMore } = await repository.listByProjectPaginated(
      projectId,
      { limit: 10 },
    )
    expect(rows).toEqual([])
    expect(hasMore).toBe(false)
  })
})

describe('findById', () => {
  it('finds a domain scoped to its project and mode', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    const found = await repository.findById(
      projectId,
      'live',
      created.domain.id,
    )
    expect(found?.id).toBe(created.domain.id)
  })

  it("returns undefined for another project's domain", async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()
    const created = await repository.claim(claimValues(projectA))
    if (!created) throw new Error('setup failed')

    expect(
      await repository.findById(projectB, 'live', created.domain.id),
    ).toBeUndefined()
  })

  it('returns undefined when the mode does not match', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(
      claimValues(projectId, { mode: 'live' }),
    )
    if (!created) throw new Error('setup failed')

    expect(
      await repository.findById(projectId, 'test', created.domain.id),
    ).toBeUndefined()
  })
})

describe('findByProjectId', () => {
  it('finds a domain scoped to its project, regardless of mode', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(
      claimValues(projectId, { mode: 'test' }),
    )
    if (!created) throw new Error('setup failed')

    const found = await repository.findByProjectId(projectId, created.domain.id)
    expect(found?.id).toBe(created.domain.id)
  })

  it("returns undefined for another project's domain", async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()
    const created = await repository.claim(claimValues(projectA))
    if (!created) throw new Error('setup failed')

    expect(
      await repository.findByProjectId(projectB, created.domain.id),
    ).toBeUndefined()
  })

  it('returns undefined for an unknown id', async () => {
    const projectId = await createTestProject()
    expect(
      await repository.findByProjectId(projectId, randomUUID()),
    ).toBeUndefined()
  })
})

describe('findLatestChallenge', () => {
  it('returns the most recently created challenge for a domain', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    const [newerChallenge] = await db
      .insert(challenges)
      .values({
        domainId: created.domain.id,
        method: 'dns_txt',
        token: 'newer-token',
        recordHost: created.challenge.recordHost,
        recordValue: 'test-verify=newer',
        expiresAt: new Date(Date.now() + 120_000),
        createdAt: new Date(Date.now() + 1_000),
      })
      .returning()

    const latest = await repository.findLatestChallenge(created.domain.id)
    expect(latest?.id).toBe(newerChallenge?.id)
  })

  it('returns undefined for a domain with no challenges', async () => {
    expect(await repository.findLatestChallenge(randomUUID())).toBeUndefined()
  })
})

describe('release', () => {
  it('deletes the domain and cascades its challenge and timeline event', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    const released = await repository.release(
      projectId,
      'live',
      created.domain.id,
    )
    expect(released?.id).toBe(created.domain.id)

    expect(
      await repository.findById(projectId, 'live', created.domain.id),
    ).toBeUndefined()

    const remainingChallenges = await db
      .select()
      .from(challenges)
      .where(eq(challenges.domainId, created.domain.id))
    expect(remainingChallenges).toHaveLength(0)
  })

  it("returns undefined for a domain id that doesn't belong to the project", async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()
    const created = await repository.claim(claimValues(projectA))
    if (!created) throw new Error('setup failed')

    expect(
      await repository.release(projectB, 'live', created.domain.id),
    ).toBeUndefined()

    expect(
      await repository.findById(projectA, 'live', created.domain.id),
    ).toBeDefined()
  })
})

describe('recordVerificationAttempt', () => {
  it('updates the domain status', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    const verifiedAt = new Date()
    const updated = await repository.recordVerificationAttempt(
      attemptValues(created.domain.id, { nextStatus: 'verified', verifiedAt }),
    )

    expect(updated.status).toBe('verified')
    expect(updated.verifiedAt?.getTime()).toBe(verifiedAt.getTime())
  })

  it('leaves verifiedAt untouched when not provided', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')
    expect(created.domain.verifiedAt).toBeNull()

    const updated = await repository.recordVerificationAttempt(
      attemptValues(created.domain.id, { nextStatus: 'pending' }),
    )

    expect(updated.status).toBe('pending')
    expect(updated.verifiedAt).toBeNull()
  })

  it('bumps updatedAt', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    await new Promise((resolve) => setTimeout(resolve, 10))

    const updated = await repository.recordVerificationAttempt(
      attemptValues(created.domain.id, { nextStatus: 'pending' }),
    )

    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      created.domain.updatedAt.getTime(),
    )
  })

  it('throws when the domain id does not exist', async () => {
    await expect(
      repository.recordVerificationAttempt(
        attemptValues(randomUUID(), { nextStatus: 'pending' }),
      ),
    ).rejects.toThrow(/No domain found/)
  })

  it('persists lastCheckedAt, nextCheckAt, and checkAttempts', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')
    expect(created.domain.lastCheckedAt).toBeNull()

    const checkedAt = new Date()
    const nextCheckAt = new Date(checkedAt.getTime() + 5 * 60_000)
    const updated = await repository.recordVerificationAttempt({
      domainId: created.domain.id,
      nextStatus: 'pending',
      checkedAt,
      nextCheckAt,
      checkAttempts: 1,
    })

    expect(updated.lastCheckedAt?.getTime()).toBe(checkedAt.getTime())
    expect(updated.nextCheckAt?.getTime()).toBe(nextCheckAt.getTime())
    expect(updated.checkAttempts).toBe(1)
  })

  it('clears nextCheckAt when set to null (a failed domain has no more automatic checks)', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    const updated = await repository.recordVerificationAttempt(
      attemptValues(created.domain.id, {
        nextStatus: 'failed',
        nextCheckAt: null,
      }),
    )

    expect(updated.status).toBe('failed')
    expect(updated.nextCheckAt).toBeNull()
  })

  it('sets graceExpiresAt when provided, and leaves it untouched when omitted', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    const graceExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
    const opened = await repository.recordVerificationAttempt(
      attemptValues(created.domain.id, {
        nextStatus: 'temporarily_failed',
        graceExpiresAt,
      }),
    )
    expect(opened.graceExpiresAt?.getTime()).toBe(graceExpiresAt.getTime())

    const untouched = await repository.recordVerificationAttempt(
      attemptValues(created.domain.id, { nextStatus: 'temporarily_failed' }),
    )
    expect(untouched.graceExpiresAt?.getTime()).toBe(graceExpiresAt.getTime())
  })

  it('clears graceExpiresAt when explicitly set to null', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    await repository.recordVerificationAttempt(
      attemptValues(created.domain.id, {
        nextStatus: 'temporarily_failed',
        graceExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      }),
    )

    const recovered = await repository.recordVerificationAttempt(
      attemptValues(created.domain.id, {
        nextStatus: 'verified',
        graceExpiresAt: null,
      }),
    )
    expect(recovered.graceExpiresAt).toBeNull()
  })
})

describe('findDueForRecheck', () => {
  it('returns domains whose nextCheckAt has elapsed, oldest first', async () => {
    const projectId = await createTestProject()
    const now = new Date()

    const due = await repository.claim(claimValues(projectId))
    if (!due) throw new Error('setup failed')
    await db
      .update(domains)
      .set({ nextCheckAt: new Date(now.getTime() - 60_000) })
      .where(eq(domains.id, due.domain.id))

    const notYetDue = await repository.claim(claimValues(projectId))
    if (!notYetDue) throw new Error('setup failed')
    await db
      .update(domains)
      .set({ nextCheckAt: new Date(now.getTime() + 60_000) })
      .where(eq(domains.id, notYetDue.domain.id))

    const noSchedule = await repository.claim(claimValues(projectId))
    if (!noSchedule) throw new Error('setup failed')
    await db
      .update(domains)
      .set({ nextCheckAt: null })
      .where(eq(domains.id, noSchedule.domain.id))

    const result = await repository.findDueForRecheck(now, 10)
    const ids = result.map((row) => row.id)

    expect(ids).toContain(due.domain.id)
    expect(ids).not.toContain(notYetDue.domain.id)
    expect(ids).not.toContain(noSchedule.domain.id)
  })

  it('caps results at limit', async () => {
    const projectId = await createTestProject()
    const now = new Date()

    for (let i = 0; i < 3; i++) {
      const created = await repository.claim(claimValues(projectId))
      if (!created) throw new Error('setup failed')
      await db
        .update(domains)
        .set({ nextCheckAt: new Date(now.getTime() - 60_000) })
        .where(eq(domains.id, created.domain.id))
    }

    const result = await repository.findDueForRecheck(now, 2)
    expect(result).toHaveLength(2)
  })
})

describe('findOverdueGraceWindows', () => {
  it('returns only temporarily_failed domains past their grace_expires_at', async () => {
    const projectId = await createTestProject()
    const now = new Date()

    const expired = await repository.claim(claimValues(projectId))
    if (!expired) throw new Error('setup failed')
    await db
      .update(domains)
      .set({
        status: 'temporarily_failed',
        graceExpiresAt: new Date(now.getTime() - 60_000),
      })
      .where(eq(domains.id, expired.domain.id))

    const stillInGrace = await repository.claim(claimValues(projectId))
    if (!stillInGrace) throw new Error('setup failed')
    await db
      .update(domains)
      .set({
        status: 'temporarily_failed',
        graceExpiresAt: new Date(now.getTime() + 60_000),
      })
      .where(eq(domains.id, stillInGrace.domain.id))

    const pendingPastSameTimestamp = await repository.claim(
      claimValues(projectId),
    )
    if (!pendingPastSameTimestamp) throw new Error('setup failed')
    await db
      .update(domains)
      .set({ graceExpiresAt: new Date(now.getTime() - 60_000) })
      .where(eq(domains.id, pendingPastSameTimestamp.domain.id))

    const result = await repository.findOverdueGraceWindows(now, 10)
    const ids = result.map((row) => row.id)

    expect(ids).toContain(expired.domain.id)
    expect(ids).not.toContain(stillInGrace.domain.id)
    expect(ids).not.toContain(pendingPastSameTimestamp.domain.id)
  })
})
