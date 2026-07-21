import { describe, expect, it } from 'vitest'
import type { AccountsService } from '@modules/accounts/service'
import type { KeysService } from '@modules/keys/service'
import type {
  CreateProjectRowsResult,
  ProjectRow,
  ProjectsRepository,
} from './repository'
import { createProjectsService } from './service'

function fakeAccountsService(accountId = 'account_1'): AccountsService {
  return {
    async ensureAccount() {
      return { accountId, created: false, email: null }
    },
    async getEmailForProject() {
      return undefined
    },
  }
}

function projectRow(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 'project_1',
    accountId: 'account_1',
    name: 'Skylane HR',
    slug: 'skylane-hr',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function fakeProjectsRepository(
  overrides: Partial<ProjectsRepository> = {},
): ProjectsRepository {
  return {
    async listByAccountId() {
      return []
    },
    async findByIdForAccount() {
      return undefined
    },
    async findSlugById() {
      return undefined
    },
    async updateName(projectId, name) {
      return projectId === 'project_1' ? projectRow({ name }) : undefined
    },
    async createProject(accountId, name, slug, keys) {
      const project = projectRow({ accountId, name, slug })
      return {
        project,
        apiKeys: keys.map((key, index) => ({
          id: `key_row_${index}`,
          projectId: project.id,
          mode: key.mode,
          keyId: key.keyId,
          secretHash: key.secretHash,
          last4: key.last4,
          name: key.name,
          revokedAt: null,
          lastUsedAt: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        })),
      }
    },
    ...overrides,
  }
}

function fakeKeysService(): KeysService {
  return {
    async createKey() {
      throw new Error('not used in these tests')
    },
    async listKeys() {
      return []
    },
    async revokeKey() {
      return null
    },
    async rotateKey() {
      return null
    },
    generateKeyMaterial(mode) {
      return {
        key: `dp_${mode}_generated_secret`,
        insert: {
          mode,
          keyId: `${mode}keyid_____`.slice(0, 12),
          secretHash: `hash-${mode}`,
          last4: 'abcd',
          name: null,
        },
      }
    },
    toListItem(row) {
      return {
        keyId: row.keyId,
        mode: row.mode,
        maskedKey: `dp_${row.mode}_${row.keyId}_...${row.last4}`,
        last4: row.last4,
        name: row.name,
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt,
        revokedAt: row.revokedAt,
      }
    },
  }
}

describe('listProjects', () => {
  it('bootstraps the account then lists its projects', async () => {
    const repository = fakeProjectsRepository({
      async listByAccountId(accountId) {
        return accountId === 'account_1' ? [projectRow()] : []
      },
    })
    const service = createProjectsService(
      repository,
      fakeAccountsService('account_1'),
      fakeKeysService(),
    )

    const projects = await service.listProjects('user_123')
    expect(projects).toEqual([
      {
        id: 'project_1',
        name: 'Skylane HR',
        slug: 'skylane-hr',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ])
  })

  it('returns an empty list for a fresh account', async () => {
    const service = createProjectsService(
      fakeProjectsRepository(),
      fakeAccountsService(),
      fakeKeysService(),
    )

    expect(await service.listProjects('user_123')).toEqual([])
  })
})

describe('createProject', () => {
  it('derives a slug from the name and mints both test and live keys atomically', async () => {
    const service = createProjectsService(
      fakeProjectsRepository(),
      fakeAccountsService('account_1'),
      fakeKeysService(),
    )

    const result = await service.createProject('user_123', 'Skylane HR')

    expect(result.project.name).toBe('Skylane HR')
    expect(result.project.slug).toBe('skylane-hr')
    expect(result.keys.test.key).toBe('dp_test_generated_secret')
    expect(result.keys.live.key).toBe('dp_live_generated_secret')
    expect(result.keys.test.apiKey.mode).toBe('test')
    expect(result.keys.live.apiKey.mode).toBe('live')
  })

  it('throws if the repository fails to return both a test and a live key', async () => {
    const repository = fakeProjectsRepository({
      async createProject(accountId, name, slug) {
        return {
          project: projectRow({ accountId, name, slug }),
          apiKeys: [],
        } satisfies CreateProjectRowsResult
      },
    })
    const service = createProjectsService(
      repository,
      fakeAccountsService(),
      fakeKeysService(),
    )

    await expect(
      service.createProject('user_123', 'Skylane HR'),
    ).rejects.toThrow(/expected both a test and a live key/)
  })
})

describe('resolveOwnedProject', () => {
  it('resolves a project owned by the bootstrapped account', async () => {
    const repository = fakeProjectsRepository({
      async findByIdForAccount(projectId, accountId) {
        return projectId === 'project_1' && accountId === 'account_1'
          ? projectRow()
          : undefined
      },
    })
    const service = createProjectsService(
      repository,
      fakeAccountsService('account_1'),
      fakeKeysService(),
    )

    expect(await service.resolveOwnedProject('user_123', 'project_1')).toBe(
      'project_1',
    )
  })

  it('returns undefined for a project belonging to a different account', async () => {
    const service = createProjectsService(
      fakeProjectsRepository(),
      fakeAccountsService('account_1'),
      fakeKeysService(),
    )

    expect(
      await service.resolveOwnedProject('user_123', 'someone_elses_project'),
    ).toBeUndefined()
  })
})

describe('getProjectSlug', () => {
  it("returns the project's slug", async () => {
    const repository = fakeProjectsRepository({
      async findSlugById(projectId) {
        return projectId === 'project_1' ? 'skylane' : undefined
      },
    })
    const service = createProjectsService(
      repository,
      fakeAccountsService(),
      fakeKeysService(),
    )

    expect(await service.getProjectSlug('project_1')).toBe('skylane')
  })

  it('returns undefined for an unknown project id', async () => {
    const service = createProjectsService(
      fakeProjectsRepository(),
      fakeAccountsService(),
      fakeKeysService(),
    )

    expect(await service.getProjectSlug('unknown')).toBeUndefined()
  })
})

describe('renameProject', () => {
  it('updates the name and leaves the slug untouched', async () => {
    const repository = fakeProjectsRepository({
      async updateName(projectId, name) {
        return projectId === 'project_1'
          ? projectRow({ name, slug: 'skylane-hr' })
          : undefined
      },
    })
    const service = createProjectsService(
      repository,
      fakeAccountsService(),
      fakeKeysService(),
    )

    const result = await service.renameProject('project_1', 'Skylane People')
    expect(result.name).toBe('Skylane People')
    expect(result.slug).toBe('skylane-hr')
  })

  it('throws if the repository finds no such project', async () => {
    const service = createProjectsService(
      fakeProjectsRepository({
        async updateName() {
          return undefined
        },
      }),
      fakeAccountsService(),
      fakeKeysService(),
    )

    await expect(service.renameProject('unknown', 'New Name')).rejects.toThrow(
      /no such project/,
    )
  })
})
