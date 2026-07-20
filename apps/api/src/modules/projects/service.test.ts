import { describe, expect, it } from 'vitest'
import type { AccountsService } from '@modules/accounts/service'
import type { ProjectsRepository } from './repository'
import { createProjectsService } from './service'

function fakeAccountsService(accountId = 'account_1'): AccountsService {
  return {
    async ensureAccount() {
      return { accountId, created: false }
    },
  }
}

function fakeProjectsRepository(
  byAccountId: Record<string, string> = {},
): ProjectsRepository {
  return {
    async findDefaultProjectId(accountId) {
      return byAccountId[accountId]
    },
  }
}

describe('getDefaultProjectId', () => {
  it('resolves the account then returns its default project id', async () => {
    const service = createProjectsService(
      fakeProjectsRepository({ account_1: 'project_1' }),
      fakeAccountsService('account_1'),
    )

    expect(await service.getDefaultProjectId('user_123')).toBe('project_1')
  })

  it('throws if the account has no default project', async () => {
    const service = createProjectsService(
      fakeProjectsRepository({}),
      fakeAccountsService('account_1'),
    )

    await expect(service.getDefaultProjectId('user_123')).rejects.toThrow(
      /No project found for account/,
    )
  })
})
