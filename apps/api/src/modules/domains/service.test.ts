import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOKEN_TTL_MS,
  recordValue,
  type DnsResolver,
} from '@domainproof/core'
import { createFixtureResolver } from '@domainproof/core/testing'
import type { ProjectsService } from '@modules/projects/service'
import type { DomainEventMap, DomainEventType, EventBus } from '@shared/events'
import type { ResolverForChallenge, ResolverForChallengeInput } from './ports'
import type {
  ChallengeRow,
  ClaimInsert,
  DomainRow,
  DomainsRepository,
} from './repository'
import { createDomainsService } from './service'

/**
 * A fake DomainsRepository implementing the port directly, in memory — no
 * real db. The repository's own persistence behavior (the unique
 * constraint, the transactional claim + challenge insert, cascade delete)
 * is covered by repository.test.ts against a real db; this file only
 * tests the service's own logic: domain normalization, branded record
 * generation, result mapping, and published events.
 */
function fakeRepository(): DomainsRepository {
  const domainRows = new Map<string, DomainRow>()
  const challengesByDomainId = new Map<string, ChallengeRow[]>()

  function conflicts(values: ClaimInsert): boolean {
    return [...domainRows.values()].some(
      (row) =>
        row.projectId === values.projectId &&
        row.domain === values.domain &&
        row.mode === values.mode,
    )
  }

  return {
    async claim(values) {
      if (conflicts(values)) {
        return undefined
      }

      const domainRow: DomainRow = {
        id: randomUUID(),
        projectId: values.projectId,
        domain: values.domain,
        mode: values.mode,
        status: values.status,
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedAt: null,
      }
      domainRows.set(domainRow.id, domainRow)

      const challengeRow: ChallengeRow = {
        id: randomUUID(),
        domainId: domainRow.id,
        method: values.challenge.method,
        token: values.challenge.token,
        recordHost: values.challenge.recordHost,
        recordValue: values.challenge.recordValue,
        expiresAt: values.challenge.expiresAt,
        supersededAt: null,
        createdAt: new Date(),
      }
      challengesByDomainId.set(domainRow.id, [challengeRow])

      return { domain: domainRow, challenge: challengeRow }
    },

    async listByProject(projectId, mode) {
      return [...domainRows.values()].filter(
        (row) => row.projectId === projectId && row.mode === mode,
      )
    },

    async findById(projectId, mode, id) {
      const row = domainRows.get(id)
      if (!row || row.projectId !== projectId || row.mode !== mode) {
        return undefined
      }
      return row
    },

    async findLatestChallenge(domainId) {
      const rows = challengesByDomainId.get(domainId)
      return rows?.[rows.length - 1]
    },

    async release(projectId, mode, id) {
      const row = domainRows.get(id)
      if (!row || row.projectId !== projectId || row.mode !== mode) {
        return undefined
      }
      domainRows.delete(id)
      challengesByDomainId.delete(id)
      return row
    },

    async recordVerificationAttempt(values) {
      const row = domainRows.get(values.domainId)
      if (!row) {
        throw new Error(`No domain found for id ${values.domainId}`)
      }

      const updated: DomainRow = {
        ...row,
        status: values.nextStatus,
        updatedAt: new Date(),
        verifiedAt: values.verifiedAt ?? row.verifiedAt,
      }
      domainRows.set(row.id, updated)

      return updated
    },
  }
}

/** Records every published event, for assertions. */
function fakeEventBus(): EventBus & {
  published: { type: DomainEventType; payload: unknown }[]
} {
  const published: { type: DomainEventType; payload: unknown }[] = []
  return {
    published,
    subscribe() {},
    async publish(type, payload: DomainEventMap[DomainEventType]) {
      published.push({ type, payload })
    },
  }
}

/**
 * A `ResolverForChallenge` that always returns `resolver`, ignoring the
 * input — for tests where the resolver-selection *outcome* isn't under
 * test, only what a fixed resolver does.
 */
function fakeResolverForChallenge(resolver: DnsResolver): ResolverForChallenge {
  return () => resolver
}

/**
 * A `ResolverForChallenge` that records every call's input (so a test can
 * assert what `verifyDomain` forwarded to the resolver-selection port —
 * the domain, the challenge's record host/value, the brand slug) while
 * always answering with `resolver`.
 */
function spyResolverForChallenge(resolver: DnsResolver): {
  resolverForChallenge: ResolverForChallenge
  calls: ResolverForChallengeInput[]
} {
  const calls: ResolverForChallengeInput[] = []
  return {
    calls,
    resolverForChallenge(input) {
      calls.push(input)
      return resolver
    },
  }
}

function fakeProjectsService(
  slugsByProjectId: Record<string, string> = { project_1: 'skylane' },
): ProjectsService {
  return {
    async listProjects() {
      throw new Error('not used by domains service')
    },
    async createProject() {
      throw new Error('not used by domains service')
    },
    async resolveOwnedProject() {
      throw new Error('not used by domains service')
    },
    async getProjectSlug(projectId) {
      return slugsByProjectId[projectId]
    },
  }
}

describe('claimDomain', () => {
  it("creates a domain with a TXT record branded under the project's slug", async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    const result = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.domain.domain).toBe('example.com')
    expect(result.domain.mode).toBe('live')
    expect(result.domain.status).toBe('pending')
    expect(result.domain.challenges).toHaveLength(1)

    const [record] = result.domain.challenges
    expect(record?.method).toBe('dns_txt')
    expect(record?.recordHost).toBe('_skylane-challenge.example.com')
    expect(record?.recordValue).toMatch(/^skylane-verify=[a-z2-7]{26}$/)
  })

  it('normalizes the input domain (case, trailing dot, pasted URL)', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    const result = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'HTTPS://Example.COM/verify',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.domain.domain).toBe('example.com')
  })

  it('returns a typed conflict result for a duplicate (project, domain, mode) claim', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })
    const second = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })

    expect(second).toEqual({ ok: false, error: 'conflict' })
  })

  it('allows the same domain to be claimed again under a different mode', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })
    const testClaim = await service.claimDomain({
      projectId: 'project_1',
      mode: 'test',
      domain: 'example.com',
    })

    expect(testClaim.ok).toBe(true)
  })

  it('allows the same domain to be claimed by a different project', async () => {
    const repository = fakeRepository()
    const projects = fakeProjectsService({
      project_1: 'skylane',
      project_2: 'atlas',
    })
    const service = createDomainsService(repository, projects)

    await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })
    const second = await service.claimDomain({
      projectId: 'project_2',
      mode: 'live',
      domain: 'example.com',
    })

    expect(second.ok).toBe(true)
  })

  it('returns invalid_domain for an empty domain', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    const result = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: '',
    })

    expect(result).toEqual({
      ok: false,
      error: 'invalid_domain',
      reason: 'empty',
    })
  })

  it('returns invalid_domain for an IP address', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    const result = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: '127.0.0.1',
    })

    expect(result).toEqual({
      ok: false,
      error: 'invalid_domain',
      reason: 'is_ip',
    })
  })

  it('returns invalid_domain for a hostname with no recognized public suffix', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    const result = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'localhost',
    })

    expect(result).toEqual({
      ok: false,
      error: 'invalid_domain',
      reason: 'no_public_suffix',
    })
  })

  it('throws if the project has no slug (should never happen for an authenticated project id)', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService({}),
    )

    await expect(
      service.claimDomain({
        projectId: 'project_1',
        mode: 'live',
        domain: 'example.com',
      }),
    ).rejects.toThrow(/No project found/)
  })

  it('rejects a .test sandbox domain claimed with a live-mode key', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    const result = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'verified.test',
    })

    expect(result).toEqual({ ok: false, error: 'sandbox_requires_test_mode' })
  })

  it('allows a .test sandbox domain claimed with a test-mode key', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    const result = await service.claimDomain({
      projectId: 'project_1',
      mode: 'test',
      domain: 'verified.test',
    })

    expect(result.ok).toBe(true)
  })

  it('allows a real domain claimed with a live-mode key (the gate only blocks .test+live)', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )

    const result = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })

    expect(result.ok).toBe(true)
  })

  it('publishes domain.claimed on a successful claim', async () => {
    const eventBus = fakeEventBus()
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
      undefined,
      undefined,
      eventBus,
    )

    const result = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })
    if (!result.ok) throw new Error('setup failed')

    expect(eventBus.published).toHaveLength(1)
    expect(eventBus.published[0]).toMatchObject({
      type: 'domain.claimed',
      payload: {
        domainId: result.domain.id,
        projectId: 'project_1',
        mode: 'live',
        domain: 'example.com',
      },
    })
  })

  it('does not publish on a conflict', async () => {
    const eventBus = fakeEventBus()
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
      undefined,
      undefined,
      eventBus,
    )

    await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })
    eventBus.published.length = 0

    const second = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })

    expect(second).toEqual({ ok: false, error: 'conflict' })
    expect(eventBus.published).toHaveLength(0)
  })
})

describe('listDomains', () => {
  it('only returns domains for the given project and mode', async () => {
    const repository = fakeRepository()
    const projects = fakeProjectsService({
      project_a: 'skylane',
      project_b: 'atlas',
    })
    const service = createDomainsService(repository, projects)

    await service.claimDomain({
      projectId: 'project_a',
      mode: 'live',
      domain: 'a.com',
    })
    await service.claimDomain({
      projectId: 'project_a',
      mode: 'test',
      domain: 'a-test.com',
    })
    await service.claimDomain({
      projectId: 'project_b',
      mode: 'live',
      domain: 'b.com',
    })

    expect(await service.listDomains('project_a', 'live')).toHaveLength(1)
    expect(await service.listDomains('project_a', 'test')).toHaveLength(1)
    expect(await service.listDomains('project_b', 'live')).toHaveLength(1)
  })

  it('includes each domain’s current record', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )
    await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })

    const [summary] = await service.listDomains('project_1', 'live')
    expect(summary?.challenges).toHaveLength(1)
  })
})

describe('getDomain', () => {
  it('returns the claimed domain', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )
    const claimed = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })
    if (!claimed.ok) throw new Error('setup failed')

    const found = await service.getDomain(
      'project_1',
      'live',
      claimed.domain.id,
    )
    expect(found?.id).toBe(claimed.domain.id)
  })

  it("returns null for another project's domain", async () => {
    const repository = fakeRepository()
    const projects = fakeProjectsService({
      project_a: 'skylane',
      project_b: 'atlas',
    })
    const service = createDomainsService(repository, projects)
    const claimed = await service.claimDomain({
      projectId: 'project_a',
      mode: 'live',
      domain: 'example.com',
    })
    if (!claimed.ok) throw new Error('setup failed')

    expect(
      await service.getDomain('project_b', 'live', claimed.domain.id),
    ).toBeNull()
  })

  it('returns null for an unknown id', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )
    expect(
      await service.getDomain('project_1', 'live', randomUUID()),
    ).toBeNull()
  })
})

describe('releaseDomain', () => {
  it('releases a claimed domain', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
    )
    const claimed = await service.claimDomain({
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })
    if (!claimed.ok) throw new Error('setup failed')

    const released = await service.releaseDomain(
      'project_1',
      'live',
      claimed.domain.id,
    )
    expect(released?.id).toBe(claimed.domain.id)

    expect(
      await service.getDomain('project_1', 'live', claimed.domain.id),
    ).toBeNull()
  })

  it("returns null for a domain id that doesn't belong to the project", async () => {
    const repository = fakeRepository()
    const projects = fakeProjectsService({
      project_a: 'skylane',
      project_b: 'atlas',
    })
    const service = createDomainsService(repository, projects)
    const claimed = await service.claimDomain({
      projectId: 'project_a',
      mode: 'live',
      domain: 'example.com',
    })
    if (!claimed.ok) throw new Error('setup failed')

    expect(
      await service.releaseDomain('project_b', 'live', claimed.domain.id),
    ).toBeNull()
  })
})

describe('verifyDomain', () => {
  async function claimAndGetChallenge(
    service: ReturnType<typeof createDomainsService>,
    domain = 'example.com',
    projectId = 'project_1',
    mode: 'live' | 'test' = 'live',
  ) {
    const claimed = await service.claimDomain({
      projectId,
      mode,
      domain,
    })
    if (!claimed.ok) throw new Error('setup failed')
    const [challenge] = claimed.domain.challenges
    if (!challenge) throw new Error('setup failed: no challenge')
    return { domainId: claimed.domain.id, challenge }
  }

  it('found: transitions pending -> verified and sets verifiedAt', async () => {
    const repository = fakeRepository()
    const eventBus = fakeEventBus()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()), // seeded below
      undefined,
      eventBus,
    )
    const { domainId, challenge } = await claimAndGetChallenge(service)
    eventBus.published.length = 0 // drop the domain.claimed from setup

    const resolver = createFixtureResolver({
      [challenge.recordHost]: [challenge.recordValue],
    })
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(resolver),
      undefined,
      eventBus,
    )

    const result = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.check.outcome).toBe('found')
    expect(result.check.detectedValues).toEqual([])
    expect(result.domain.status).toBe('verified')
    expect(result.domain.verifiedAt).not.toBeNull()

    expect(eventBus.published).toEqual([
      {
        type: 'domain.check_passed',
        payload: expect.objectContaining({ domainId }),
      },
      {
        type: 'domain.verified',
        payload: expect.objectContaining({ domainId }),
      },
    ])
  })

  it('not_found: stays pending, publishes domain.check_failed, no transition event', async () => {
    const repository = fakeRepository()
    const eventBus = fakeEventBus()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
      undefined,
      eventBus,
    )
    const { domainId } = await claimAndGetChallenge(service)
    eventBus.published.length = 0 // drop the domain.claimed from setup

    const result = await service.verifyDomain('project_1', 'live', domainId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.check.outcome).toBe('not_found')
    expect(result.domain.status).toBe('pending')
    expect(result.domain.verifiedAt).toBeNull()

    expect(eventBus.published).toEqual([
      {
        type: 'domain.check_failed',
        payload: expect.objectContaining({ domainId, outcome: 'not_found' }),
      },
    ])
  })

  it('wrong_value: transitions pending -> failed, publishes check_failed and domain.failed', async () => {
    const repository = fakeRepository()
    const eventBus = fakeEventBus()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
      undefined,
      eventBus,
    )
    const { domainId, challenge } = await claimAndGetChallenge(service)
    eventBus.published.length = 0 // drop the domain.claimed from setup

    const wrongValue = recordValue('someotherrandomtoken1234567', 'skylane')
    const resolver = createFixtureResolver({
      [challenge.recordHost]: [wrongValue],
    })
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(resolver),
      undefined,
      eventBus,
    )

    const result = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.check.outcome).toBe('wrong_value')
    expect(result.check.detectedValues).toEqual(['someotherrandomtoken1234567'])
    expect(result.check.expectedValue).toBe(challenge.recordValue)
    expect(result.domain.status).toBe('failed')

    expect(eventBus.published).toEqual([
      {
        type: 'domain.check_failed',
        payload: expect.objectContaining({ domainId, outcome: 'wrong_value' }),
      },
      {
        type: 'domain.failed',
        payload: expect.objectContaining({ domainId }),
      },
    ])
  })

  it('unreachable: never transitions, regardless of status, and publishes nothing', async () => {
    const repository = fakeRepository()
    const eventBus = fakeEventBus()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
      undefined,
      eventBus,
    )
    const { domainId, challenge } = await claimAndGetChallenge(service)
    eventBus.published.length = 0 // drop the domain.claimed from setup

    const unreachableResolver = createFixtureResolver({
      [challenge.recordHost]: { error: 'timeout' },
    })
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(unreachableResolver),
      undefined,
      eventBus,
    )

    const result = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.check.outcome).toBe('unreachable')
    expect(result.domain.status).toBe('pending')
    expect(eventBus.published).toHaveLength(0)
  })

  describe('challenge expiry', () => {
    it('hard-fails a pending domain whose challenge has outlived the verification window, without ever running the DNS check', async () => {
      const repository = fakeRepository()
      const claimingService = createDomainsService(
        repository,
        fakeProjectsService(),
        fakeResolverForChallenge(createFixtureResolver()),
      )
      const { domainId } = await claimAndGetChallenge(claimingService)

      // A resolver that throws if ever queried — proves the expiry guard
      // short-circuits before any DNS check runs, not that the check
      // itself happened to come back unfavorable.
      const explodingResolver: DnsResolver = {
        async resolveTxt() {
          throw new Error(
            'should never be called: expiry must be checked before any DNS query',
          )
        },
      }
      const eventBus = fakeEventBus()
      const verifyingService = createDomainsService(
        repository,
        fakeProjectsService(),
        fakeResolverForChallenge(explodingResolver),
        () => new Date(Date.now() + DEFAULT_TOKEN_TTL_MS),
        eventBus,
      )

      const result = await verifyingService.verifyDomain(
        'project_1',
        'live',
        domainId,
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.check.outcome).toBe('expired')
      expect(result.check.detectedValues).toEqual([])
      expect(result.domain.status).toBe('failed')

      expect(eventBus.published).toEqual([
        {
          type: 'domain.check_failed',
          payload: expect.objectContaining({ domainId, outcome: 'expired' }),
        },
        {
          type: 'domain.failed',
          payload: expect.objectContaining({ domainId }),
        },
      ])
    })

    it('does not expire a domain still inside its verification window', async () => {
      const repository = fakeRepository()
      const claimingService = createDomainsService(
        repository,
        fakeProjectsService(),
        fakeResolverForChallenge(createFixtureResolver()),
      )
      const { domainId } = await claimAndGetChallenge(claimingService)

      const verifyingService = createDomainsService(
        repository,
        fakeProjectsService(),
        // Empty fixture (no zones seeded) -> not_found, proving the DNS
        // check actually ran rather than short-circuiting on expiry.
        fakeResolverForChallenge(createFixtureResolver()),
        () => new Date(Date.now() + DEFAULT_TOKEN_TTL_MS - 1_000),
      )

      const result = await verifyingService.verifyDomain(
        'project_1',
        'live',
        domainId,
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.check.outcome).toBe('not_found')
      expect(result.domain.status).toBe('pending')
    })

    it('does not expire an already-verified domain, even long after the original challenge window', async () => {
      const repository = fakeRepository()
      const service = createDomainsService(
        repository,
        fakeProjectsService(),
        fakeResolverForChallenge(createFixtureResolver()),
      )
      const { domainId, challenge } = await claimAndGetChallenge(service)

      const resolver = createFixtureResolver({
        [challenge.recordHost]: [challenge.recordValue],
      })
      const activeService = createDomainsService(
        repository,
        fakeProjectsService(),
        fakeResolverForChallenge(resolver),
      )
      const verified = await activeService.verifyDomain(
        'project_1',
        'live',
        domainId,
      )
      if (!verified.ok) throw new Error('setup failed')
      expect(verified.domain.status).toBe('verified')

      // Well past the original 72h verification window — expiry only ever
      // gates a still-`pending` domain (see verifyDomain's doc comment):
      // a verified domain's original challenge already did its job, and
      // its rechecks are governed by recheck_passed/recheck_record_lost,
      // not this challenge's expiry.
      const longAfterService = createDomainsService(
        repository,
        fakeProjectsService(),
        fakeResolverForChallenge(resolver),
        () => new Date(Date.now() + DEFAULT_TOKEN_TTL_MS * 10),
      )
      const result = await longAfterService.verifyDomain(
        'project_1',
        'live',
        domainId,
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.check.outcome).toBe('found')
      expect(result.domain.status).toBe('verified')
    })

    it('does not expire a temporarily_failed domain either — a different, grace-window timer applies there', async () => {
      const repository = fakeRepository()
      const service = createDomainsService(
        repository,
        fakeProjectsService(),
        fakeResolverForChallenge(createFixtureResolver()),
      )
      const { domainId, challenge } = await claimAndGetChallenge(service)

      const resolver = createFixtureResolver({
        [challenge.recordHost]: [challenge.recordValue],
      })
      const activeService = createDomainsService(
        repository,
        fakeProjectsService(),
        fakeResolverForChallenge(resolver),
      )
      await activeService.verifyDomain('project_1', 'live', domainId) // -> verified
      resolver.set(challenge.recordHost, []) // -> temporarily_failed
      const lost = await activeService.verifyDomain(
        'project_1',
        'live',
        domainId,
      )
      if (!lost.ok) throw new Error('setup failed')
      expect(lost.domain.status).toBe('temporarily_failed')

      const longAfterService = createDomainsService(
        repository,
        fakeProjectsService(),
        fakeResolverForChallenge(resolver), // still not_found (record still removed)
        () => new Date(Date.now() + DEFAULT_TOKEN_TTL_MS * 10),
      )
      const result = await longAfterService.verifyDomain(
        'project_1',
        'live',
        domainId,
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.check.outcome).toBe('not_found')
      expect(result.domain.status).toBe('temporarily_failed')
    })
  })

  it('recheck of a verified domain: a passing recheck is a no-op refresh', async () => {
    const repository = fakeRepository()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
    )
    const { domainId, challenge } = await claimAndGetChallenge(service)

    const resolver = createFixtureResolver({
      [challenge.recordHost]: [challenge.recordValue],
    })
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(resolver),
    )

    const first = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    if (!first.ok) throw new Error('setup failed')
    expect(first.domain.status).toBe('verified')

    const second = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.check.outcome).toBe('found')
    expect(second.domain.status).toBe('verified')
  })

  it('recheck of a verified domain: a lost or wrong record opens the grace window (temporarily_failed)', async () => {
    const repository = fakeRepository()
    const eventBus = fakeEventBus()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
      undefined,
      eventBus,
    )
    const { domainId, challenge } = await claimAndGetChallenge(service)

    const resolver = createFixtureResolver({
      [challenge.recordHost]: [challenge.recordValue],
    })
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(resolver),
      undefined,
      eventBus,
    )

    const verified = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    if (!verified.ok) throw new Error('setup failed')
    expect(verified.domain.status).toBe('verified')
    eventBus.published.length = 0 // drop claimed + the first verified pass

    resolver.set(challenge.recordHost, []) // record removed -> not_found
    const lost = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    expect(lost.ok).toBe(true)
    if (!lost.ok) return
    expect(lost.check.outcome).toBe('not_found')
    expect(lost.domain.status).toBe('temporarily_failed')

    expect(eventBus.published).toEqual([
      {
        type: 'domain.check_failed',
        payload: expect.objectContaining({ domainId, outcome: 'not_found' }),
      },
      {
        type: 'domain.temporarily_failed',
        payload: expect.objectContaining({ domainId }),
      },
    ])
  })

  it('recheck of a verified domain: unreachable does not open the grace window', async () => {
    const repository = fakeRepository()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
    )
    const { domainId, challenge } = await claimAndGetChallenge(service)

    const resolver = createFixtureResolver({
      [challenge.recordHost]: [challenge.recordValue],
    })
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(resolver),
    )

    const verified = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    if (!verified.ok) throw new Error('setup failed')
    expect(verified.domain.status).toBe('verified')

    resolver.set(challenge.recordHost, { error: 'timeout' })
    const unreachable = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    expect(unreachable.ok).toBe(true)
    if (!unreachable.ok) return
    expect(unreachable.check.outcome).toBe('unreachable')
    expect(unreachable.domain.status).toBe('verified')
  })

  it('temporarily_failed recovers to verified on a passing recheck', async () => {
    const repository = fakeRepository()
    const eventBus = fakeEventBus()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
      undefined,
      eventBus,
    )
    const { domainId, challenge } = await claimAndGetChallenge(service)

    const resolver = createFixtureResolver({
      [challenge.recordHost]: [challenge.recordValue],
    })
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(resolver),
      undefined,
      eventBus,
    )

    await verifyingService.verifyDomain('project_1', 'live', domainId) // -> verified
    resolver.set(challenge.recordHost, []) // -> temporarily_failed
    const lost = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    if (!lost.ok) throw new Error('setup failed')
    expect(lost.domain.status).toBe('temporarily_failed')
    eventBus.published.length = 0 // drop claimed + verified + temporarily_failed

    resolver.set(challenge.recordHost, [challenge.recordValue]) // record restored
    const recovered = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    expect(recovered.ok).toBe(true)
    if (!recovered.ok) return
    expect(recovered.check.outcome).toBe('found')
    expect(recovered.domain.status).toBe('verified')

    expect(eventBus.published).toEqual([
      {
        type: 'domain.check_passed',
        payload: expect.objectContaining({ domainId }),
      },
      {
        type: 'domain.verified',
        payload: expect.objectContaining({ domainId }),
      },
    ])
  })

  it('temporarily_failed stays temporarily_failed on another inconclusive check (grace window continues)', async () => {
    const repository = fakeRepository()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
    )
    const { domainId, challenge } = await claimAndGetChallenge(service)

    const resolver = createFixtureResolver({
      [challenge.recordHost]: [challenge.recordValue],
    })
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(resolver),
    )

    await verifyingService.verifyDomain('project_1', 'live', domainId) // -> verified
    resolver.set(challenge.recordHost, []) // -> temporarily_failed
    await verifyingService.verifyDomain('project_1', 'live', domainId)

    const stillLost = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    expect(stillLost.ok).toBe(true)
    if (!stillLost.ok) return
    expect(stillLost.check.outcome).toBe('not_found')
    expect(stillLost.domain.status).toBe('temporarily_failed')
  })

  it('failed domains never resurrect from a mere passing check', async () => {
    const repository = fakeRepository()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
    )
    const { domainId, challenge } = await claimAndGetChallenge(service)

    const wrongValue = recordValue('someotherrandomtoken1234567', 'skylane')
    const resolver = createFixtureResolver({
      [challenge.recordHost]: [wrongValue],
    })
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(resolver),
    )

    const failed = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    if (!failed.ok) throw new Error('setup failed')
    expect(failed.domain.status).toBe('failed')

    resolver.set(challenge.recordHost, [challenge.recordValue]) // now correct
    const stillFailed = await verifyingService.verifyDomain(
      'project_1',
      'live',
      domainId,
    )
    expect(stillFailed.ok).toBe(true)
    if (!stillFailed.ok) return
    expect(stillFailed.check.outcome).toBe('found')
    expect(stillFailed.domain.status).toBe('failed')
  })

  it('returns not_found for an unknown domain id', async () => {
    const service = createDomainsService(
      fakeRepository(),
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
    )

    const result = await service.verifyDomain('project_1', 'live', randomUUID())
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it("returns not_found for another project's domain", async () => {
    const repository = fakeRepository()
    const projects = fakeProjectsService({
      project_a: 'skylane',
      project_b: 'atlas',
    })
    const service = createDomainsService(
      repository,
      projects,
      fakeResolverForChallenge(createFixtureResolver()),
    )
    const { domainId } = await claimAndGetChallenge(
      service,
      'example.com',
      'project_a',
    )

    const result = await service.verifyDomain('project_b', 'live', domainId)
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('forwards the domain, challenge, and brand slug to the resolverForChallenge port', async () => {
    const repository = fakeRepository()
    const service = createDomainsService(
      repository,
      fakeProjectsService(),
      fakeResolverForChallenge(createFixtureResolver()),
    )
    const { domainId, challenge } = await claimAndGetChallenge(
      service,
      'verified.test',
      'project_1',
      'test',
    )

    const { resolverForChallenge, calls } = spyResolverForChallenge(
      createFixtureResolver({
        [challenge.recordHost]: [challenge.recordValue],
      }),
    )
    const verifyingService = createDomainsService(
      repository,
      fakeProjectsService(),
      resolverForChallenge,
    )

    await verifyingService.verifyDomain('project_1', 'test', domainId)

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      domain: 'verified.test',
      recordHost: challenge.recordHost,
      recordValue: challenge.recordValue,
      brandSlug: 'skylane',
    })
    expect(calls[0]?.challengeCreatedAt).toBeInstanceOf(Date)
    expect(typeof calls[0]?.now).toBe('function')
  })
})
