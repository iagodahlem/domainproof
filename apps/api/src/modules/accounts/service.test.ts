import { describe, expect, it, vi } from 'vitest'
import type { EventBus } from '@shared/events'
import { createFakeLogger } from '@shared/testing/fake-logger'
import type { AccountEmailResolver } from './ports'
import type { AccountRow, AccountsRepository } from './repository'
import { createAccountsService } from './service'

/**
 * A fake AccountsRepository implementing the port directly, in memory — no
 * real db. The repository's own persistence/concurrency guarantees are
 * covered by repository.test.ts against a real db; this file only tests
 * the service's orchestration logic (try create, fall back to a re-read on
 * conflict, throw on the "should never happen" gap, email resolution).
 */
function fakeRepository(
  seed: Record<string, AccountRow> = {},
): AccountsRepository {
  const state = new Map<string, AccountRow>(Object.entries(seed))
  const emailsByProjectId = new Map<string, string | undefined>()
  let nextId = 0

  return {
    async findByClerkUserId(clerkUserId) {
      return state.get(clerkUserId)
    },
    async createWithDefaultProject(clerkUserId, email) {
      if (state.has(clerkUserId)) {
        return undefined
      }
      const row: AccountRow = { id: `account_${(nextId += 1)}`, email }
      state.set(clerkUserId, row)
      emailsByProjectId.set(`project_for_${row.id}`, email ?? undefined)
      return row
    },
    async findEmailByProjectId(projectId) {
      return emailsByProjectId.get(projectId)
    },
  }
}

/** Records every published event, for assertions — never actually dispatches to a subscriber (none of these tests need one). */
function fakeEventBus(): EventBus & {
  published: { type: string; payload: unknown }[]
} {
  const published: { type: string; payload: unknown }[] = []
  return {
    published,
    subscribe() {},
    async publish(type, payload) {
      published.push({ type, payload })
    },
  }
}

describe('ensureAccount', () => {
  it('creates a new account and reports created: true', async () => {
    const service = createAccountsService(
      fakeRepository(),
      undefined,
      undefined,
      createFakeLogger(),
    )

    const result = await service.ensureAccount('user_123')

    expect(result.created).toBe(true)
    expect(result.accountId).toBeTruthy()
  })

  it('returns the existing account and reports created: false on a second call', async () => {
    const service = createAccountsService(
      fakeRepository(),
      undefined,
      undefined,
      createFakeLogger(),
    )

    const first = await service.ensureAccount('user_123')
    const second = await service.ensureAccount('user_123')

    expect(second.created).toBe(false)
    expect(second.accountId).toBe(first.accountId)
  })

  it('throws if the repository reports a conflict but the re-read finds nothing', async () => {
    const repository: AccountsRepository = {
      async findByClerkUserId() {
        return undefined
      },
      async createWithDefaultProject() {
        return undefined
      },
      async findEmailByProjectId() {
        return undefined
      },
    }
    const service = createAccountsService(
      repository,
      undefined,
      undefined,
      createFakeLogger(),
    )

    await expect(service.ensureAccount('user_123')).rejects.toThrow(
      /row not found after conflict/,
    )
  })

  it('publishes account.created only when it actually creates the account', async () => {
    const eventBus = fakeEventBus()
    const service = createAccountsService(
      fakeRepository(),
      eventBus,
      undefined,
      createFakeLogger(),
    )

    await service.ensureAccount('user_123')
    await service.ensureAccount('user_123') // second call: existing account

    expect(eventBus.published).toHaveLength(1)
    expect(eventBus.published[0]).toMatchObject({
      type: 'account.created',
      payload: { clerkUserId: 'user_123' },
    })
  })

  it('stores the emailHint (from session claims) on creation and publishes it', async () => {
    const eventBus = fakeEventBus()
    const service = createAccountsService(
      fakeRepository(),
      eventBus,
      undefined,
      createFakeLogger(),
    )

    const result = await service.ensureAccount(
      'user_123',
      'builder@example.com',
    )

    expect(result.email).toBe('builder@example.com')
    expect(eventBus.published[0]?.payload).toMatchObject({
      email: 'builder@example.com',
    })
  })

  it('falls back to the email resolver port when there is no emailHint', async () => {
    const resolver: AccountEmailResolver = {
      resolveEmail: async () => 'resolved@example.com',
    }
    const service = createAccountsService(
      fakeRepository(),
      undefined,
      resolver,
      createFakeLogger(),
    )

    const result = await service.ensureAccount('user_123')
    expect(result.email).toBe('resolved@example.com')
  })

  it('resolves to a null email (never throws) when neither source has one', async () => {
    const service = createAccountsService(
      fakeRepository(),
      undefined,
      undefined,
      createFakeLogger(),
    )

    const result = await service.ensureAccount('user_123')
    expect(result.email).toBeNull()
  })

  it('never calls the email resolver for an already-existing account', async () => {
    const resolveEmail = vi.fn(async () => 'resolved@example.com')
    const service = createAccountsService(
      fakeRepository(),
      undefined,
      { resolveEmail },
      createFakeLogger(),
    )

    await service.ensureAccount('user_123')
    resolveEmail.mockClear()
    await service.ensureAccount('user_123')

    expect(resolveEmail).not.toHaveBeenCalled()
  })
})

describe('getEmailForProject', () => {
  it("delegates to the repository's projectId -> email lookup", async () => {
    const repository = fakeRepository()
    const service = createAccountsService(
      repository,
      undefined,
      undefined,
      createFakeLogger(),
    )

    const { accountId } = await service.ensureAccount(
      'user_123',
      'builder@example.com',
    )

    expect(await service.getEmailForProject(`project_for_${accountId}`)).toBe(
      'builder@example.com',
    )
  })
})
