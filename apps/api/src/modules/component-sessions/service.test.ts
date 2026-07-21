import { describe, expect, it } from 'vitest'
import type {
  ClaimDomainInput,
  DomainsService,
  DomainSummary,
} from '@modules/domains/service'
import type {
  ComponentSessionRow,
  ComponentSessionsRepository,
} from './repository'
import { createComponentSessionsService } from './service'

function domainSummary(overrides: Partial<DomainSummary> = {}): DomainSummary {
  return {
    id: 'domain_1',
    projectId: 'project_1',
    domain: 'example.com',
    mode: 'test',
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    verifiedAt: null,
    challenges: [],
    frontendToken: 'frontend-token-1',
    lastCheck: null,
    externalId: null,
    ...overrides,
  }
}

function sessionRow(
  overrides: Partial<ComponentSessionRow> = {},
): ComponentSessionRow {
  return {
    id: 'session_1',
    projectId: 'project_1',
    mode: 'test',
    externalId: null,
    token: 'session-token-1',
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function fakeRepository(
  overrides: Partial<ComponentSessionsRepository> = {},
): ComponentSessionsRepository {
  return {
    async create(values) {
      return sessionRow({ ...values, externalId: values.externalId ?? null })
    },
    async consumeIfAvailable() {
      return undefined
    },
    ...overrides,
  }
}

/**
 * A fake DomainsService implementing the full port directly, in memory —
 * this file only exercises `ComponentSessionsService`'s own logic (does it
 * consume before claiming, does it thread `projectId`/`mode`/`externalId`
 * through, does it pass a claim failure through unchanged), never
 * `DomainsService`'s own claiming rules, which are covered by
 * `modules/domains/service.test.ts`.
 */
function fakeDomainsService(
  overrides: Partial<DomainsService> = {},
): DomainsService {
  return {
    async claimDomain() {
      throw new Error('not implemented')
    },
    async listDomains() {
      return { domains: [], nextCursor: null }
    },
    async listProjectDomains() {
      return { domains: [], nextCursor: null }
    },
    async getDomain() {
      return null
    },
    async getProjectDomain() {
      return null
    },
    async getDomainByFrontendToken() {
      return null
    },
    async releaseDomain() {
      return null
    },
    async releaseProjectDomain() {
      return null
    },
    async verifyDomain() {
      return { ok: false, error: 'not_found' }
    },
    async verifyProjectDomain() {
      return { ok: false, error: 'not_found' }
    },
    async verifyDomainByFrontendToken() {
      return { ok: false, error: 'not_found' }
    },
    async regenerateChallenge() {
      return { ok: false, error: 'not_found' }
    },
    async regenerateProjectChallenge() {
      return { ok: false, error: 'not_found' }
    },
    async recheckDueDomains() {
      return { processed: 0, errors: [] }
    },
    async expireOverdueGraceWindows() {
      return { processed: 0, errors: [] }
    },
    ...overrides,
  }
}

describe('createSession', () => {
  it('generates a token, persists it, and returns an expiry one hour out', async () => {
    const now = () => new Date('2026-01-01T00:00:00Z')
    let created: unknown
    const repository = fakeRepository({
      async create(values) {
        created = values
        return sessionRow({ ...values, externalId: values.externalId ?? null })
      },
    })
    const service = createComponentSessionsService(
      repository,
      fakeDomainsService(),
      now,
    )

    const result = await service.createSession({
      projectId: 'project_1',
      mode: 'live',
      externalId: 'user_42',
    })

    expect(result.sessionToken).toMatch(/^[a-z2-7]{26}$/)
    expect(result.expiresAt.getTime()).toBe(now().getTime() + 60 * 60 * 1000)
    expect(created).toMatchObject({
      projectId: 'project_1',
      mode: 'live',
      externalId: 'user_42',
      token: result.sessionToken,
    })
  })

  it('mints without an externalId when none is given', async () => {
    let created: unknown
    const repository = fakeRepository({
      async create(values) {
        created = values
        return sessionRow({ ...values, externalId: values.externalId ?? null })
      },
    })
    const service = createComponentSessionsService(
      repository,
      fakeDomainsService(),
    )

    await service.createSession({ projectId: 'project_1', mode: 'test' })

    expect((created as { externalId?: string }).externalId).toBeUndefined()
  })
})

describe('claimDomain', () => {
  it('returns session_not_found when the repository cannot consume the token', async () => {
    const repository = fakeRepository({
      async consumeIfAvailable() {
        return undefined
      },
    })
    const service = createComponentSessionsService(
      repository,
      fakeDomainsService(),
    )

    const result = await service.claimDomain('unknown-token', 'example.com')

    expect(result).toEqual({ ok: false, error: 'session_not_found' })
  })

  it('claims through DomainsService with the session project/mode and stamps externalId', async () => {
    const session = sessionRow({
      projectId: 'project_9',
      mode: 'live',
      externalId: 'user_7',
      token: 'session-token-9',
    })
    const repository = fakeRepository({
      async consumeIfAvailable(token) {
        return token === session.token ? session : undefined
      },
    })
    let claimInput: ClaimDomainInput | undefined
    const domainsService = fakeDomainsService({
      async claimDomain(input) {
        claimInput = input
        return {
          ok: true,
          domain: domainSummary({
            projectId: input.projectId,
            mode: input.mode,
            externalId: input.externalId ?? null,
          }),
        }
      },
    })
    const service = createComponentSessionsService(repository, domainsService)

    const result = await service.claimDomain(session.token, 'example.com')

    expect(result.ok).toBe(true)
    expect(claimInput).toEqual({
      projectId: 'project_9',
      mode: 'live',
      domain: 'example.com',
      externalId: 'user_7',
    })
  })

  it('propagates a claim failure (e.g. conflict) rather than masking it as session_not_found', async () => {
    const session = sessionRow()
    const repository = fakeRepository({
      async consumeIfAvailable() {
        return session
      },
    })
    const domainsService = fakeDomainsService({
      async claimDomain() {
        return { ok: false, error: 'conflict' }
      },
    })
    const service = createComponentSessionsService(repository, domainsService)

    const result = await service.claimDomain(session.token, 'example.com')

    expect(result).toEqual({ ok: false, error: 'conflict' })
  })

  it('is single-use even when the underlying claim fails: a second attempt sees the session already consumed', async () => {
    const session = sessionRow()
    let consumeCalls = 0
    const repository = fakeRepository({
      async consumeIfAvailable() {
        consumeCalls += 1
        return consumeCalls === 1 ? session : undefined
      },
    })
    const domainsService = fakeDomainsService({
      async claimDomain() {
        return { ok: false, error: 'invalid_domain', reason: 'invalid_format' }
      },
    })
    const service = createComponentSessionsService(repository, domainsService)

    const first = await service.claimDomain(session.token, 'not a domain')
    expect(first).toEqual({
      ok: false,
      error: 'invalid_domain',
      reason: 'invalid_format',
    })

    const second = await service.claimDomain(session.token, 'example.com')
    expect(second).toEqual({ ok: false, error: 'session_not_found' })
  })
})
