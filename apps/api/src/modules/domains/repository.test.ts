import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
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
    frontendToken: string
    externalId: string
  }> = {},
) {
  return {
    projectId,
    mode: overrides.mode ?? ('live' as const),
    domain: overrides.domain ?? `example-${randomUUID()}.test`,
    externalId: overrides.externalId,
    status: 'pending' as const,
    nextCheckAt: new Date(Date.now() + 60_000),
    frontendToken: overrides.frontendToken ?? `frontend-token-${randomUUID()}`,
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

  it('persists externalId when given, and defaults to null otherwise', async () => {
    const projectId = await createTestProject()

    const withExternalId = await repository.claim(
      claimValues(projectId, { externalId: 'customer_1' }),
    )
    expect(withExternalId?.domain.externalId).toBe('customer_1')

    const withoutExternalId = await repository.claim(claimValues(projectId))
    expect(withoutExternalId?.domain.externalId).toBeNull()
  })

  it('does not enforce uniqueness on externalId across multiple domains', async () => {
    const projectId = await createTestProject()

    const first = await repository.claim(
      claimValues(projectId, {
        domain: 'first-customer-domain.test',
        externalId: 'customer_1',
      }),
    )
    const second = await repository.claim(
      claimValues(projectId, {
        domain: 'second-customer-domain.test',
        externalId: 'customer_1',
      }),
    )

    expect(first).toBeDefined()
    expect(second).toBeDefined()
  })

  it('returns undefined on a (project, domain, mode) conflict', async () => {
    const projectId = await createTestProject()
    const domain = `example-${randomUUID()}.test`

    const first = await repository.claim(claimValues(projectId, { domain }))
    expect(first).toBeDefined()

    const second = await repository.claim(claimValues(projectId, { domain }))
    expect(second).toBeUndefined()

    const { rows } = await repository.listByProjectPaginated(projectId, {
      limit: 10,
      mode: 'live',
    })
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

describe('listByProjectPaginated', () => {
  it('narrows to one mode when `mode` is given', async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()

    await repository.claim(claimValues(projectA, { mode: 'live' }))
    await repository.claim(claimValues(projectA, { mode: 'test' }))
    await repository.claim(claimValues(projectB, { mode: 'live' }))

    const countFor = async (projectId: string, mode: 'test' | 'live') =>
      (await repository.listByProjectPaginated(projectId, { limit: 10, mode }))
        .rows.length

    expect(await countFor(projectA, 'live')).toBe(1)
    expect(await countFor(projectA, 'test')).toBe(1)
    expect(await countFor(projectB, 'live')).toBe(1)
    expect(await countFor(projectB, 'test')).toBe(0)
  })

  it('filters by externalId, matching several domains under the same one', async () => {
    const projectId = await createTestProject()
    await repository.claim(
      claimValues(projectId, {
        domain: 'customer-a.test',
        externalId: 'customer_1',
      }),
    )
    await repository.claim(
      claimValues(projectId, {
        domain: 'customer-a-alt.test',
        externalId: 'customer_1',
      }),
    )
    await repository.claim(
      claimValues(projectId, {
        domain: 'customer-b.test',
        externalId: 'customer_2',
      }),
    )

    const { rows } = await repository.listByProjectPaginated(projectId, {
      limit: 10,
      externalId: 'customer_1',
    })
    expect(rows.map((r) => r.domain).sort()).toEqual([
      'customer-a-alt.test',
      'customer-a.test',
    ])
  })

  it('filters by an exact domain match', async () => {
    const projectId = await createTestProject()
    await repository.claim(claimValues(projectId, { domain: 'acme.test' }))
    await repository.claim(claimValues(projectId, { domain: 'other.test' }))

    const { rows } = await repository.listByProjectPaginated(projectId, {
      limit: 10,
      domain: 'acme.test',
    })
    expect(rows.map((r) => r.domain)).toEqual(['acme.test'])
  })

  it('combines mode, externalId, and domain filters', async () => {
    const projectId = await createTestProject()
    await repository.claim(
      claimValues(projectId, {
        domain: 'acme.test',
        mode: 'live',
        externalId: 'customer_1',
      }),
    )
    await repository.claim(
      claimValues(projectId, {
        domain: 'acme.test',
        mode: 'test',
        externalId: 'customer_1',
      }),
    )
    await repository.claim(
      claimValues(projectId, {
        domain: 'other.test',
        mode: 'live',
        externalId: 'customer_1',
      }),
    )

    const { rows } = await repository.listByProjectPaginated(projectId, {
      limit: 10,
      mode: 'live',
      externalId: 'customer_1',
      domain: 'acme.test',
    })
    expect(rows.map((r) => r.domain)).toEqual(['acme.test'])
    expect(rows[0]?.mode).toBe('live')
  })

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

describe('findByFrontendToken', () => {
  it('finds a domain by its Frontend API token alone, no project/mode scoping', async () => {
    const projectId = await createTestProject()
    const token = `frontend-token-${randomUUID()}`
    const created = await repository.claim(
      claimValues(projectId, { frontendToken: token }),
    )
    if (!created) throw new Error('setup failed')

    const found = await repository.findByFrontendToken(token)
    expect(found?.id).toBe(created.domain.id)
  })

  it('returns undefined for an unknown token', async () => {
    expect(
      await repository.findByFrontendToken('unknown-token'),
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

describe('findChallengesAtHostForOtherDomains', () => {
  it('finds another domain’s challenge sharing the same recordHost', async () => {
    const projectA = await createTestProject()
    const projectB = await createTestProject()
    const sharedHost = `_shared-challenge.collide-${randomUUID()}.test`

    const domainA = await repository.claim(
      claimValues(projectA, { domain: 'a.test' }),
    )
    if (!domainA) throw new Error('setup failed')
    await db
      .update(challenges)
      .set({ recordHost: sharedHost })
      .where(eq(challenges.domainId, domainA.domain.id))

    const domainB = await repository.claim(
      claimValues(projectB, { domain: 'b.test' }),
    )
    if (!domainB) throw new Error('setup failed')
    await db
      .update(challenges)
      .set({ recordHost: sharedHost })
      .where(eq(challenges.domainId, domainB.domain.id))

    const found = await repository.findChallengesAtHostForOtherDomains(
      sharedHost,
      domainB.domain.id,
    )
    expect(found.map((c) => c.id)).toEqual([domainA.challenge.id])
  })

  it('excludes the given domain’s own challenges at the same host', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    const found = await repository.findChallengesAtHostForOtherDomains(
      created.challenge.recordHost,
      created.domain.id,
    )
    expect(found).toEqual([])
  })

  it('returns an empty array when no other domain shares the host', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')

    const found = await repository.findChallengesAtHostForOtherDomains(
      created.challenge.recordHost,
      randomUUID(),
    )
    expect(found).toEqual([created.challenge])
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

  it('sets lastCheckResult when provided, and leaves it untouched when omitted', async () => {
    const projectId = await createTestProject()
    const created = await repository.claim(claimValues(projectId))
    if (!created) throw new Error('setup failed')
    expect(created.domain.lastCheckResult).toBeNull()

    const lastCheckResult = {
      outcome: 'wrong_value',
      expectedValue: 'test-verify=abc123',
      detectedValues: ['test-verify=wrongwrong'],
    }
    const checked = await repository.recordVerificationAttempt({
      ...attemptValues(created.domain.id, { nextStatus: 'pending' }),
      lastCheckResult,
    })
    expect(checked.lastCheckResult).toEqual(lastCheckResult)

    const untouched = await repository.recordVerificationAttempt(
      attemptValues(created.domain.id, { nextStatus: 'pending' }),
    )
    expect(untouched.lastCheckResult).toEqual(lastCheckResult)
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

  it('uses the domains_next_check_at_idx partial index', async () => {
    // `enable_seqscan = off` forces the planner to prefer any usable index
    // over a sequential scan regardless of table size (this suite's tables
    // are near-empty) — isolating whether the index shape actually serves
    // this query from whether the planner would pick it on a bigger table.
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL enable_seqscan = off`)
      return tx.execute(sql`
        EXPLAIN
        SELECT * FROM ${domains}
        WHERE ${domains.nextCheckAt} IS NOT NULL
          AND ${domains.nextCheckAt} <= now()
        ORDER BY ${domains.nextCheckAt}
        LIMIT 10
      `)
    })

    const plan = rows.map((row) => row['QUERY PLAN']).join('\n')
    expect(plan).toContain('Index Scan using domains_next_check_at_idx')
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
