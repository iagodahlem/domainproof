import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { ProjectsService } from '@modules/projects/service'
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
 * constraint, the transactional claim + challenge + event insert, cascade
 * delete) is covered by repository.test.ts against a real db; this file
 * only tests the service's own logic: domain normalization, branded record
 * generation, and result mapping.
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
  }
}

function fakeProjectsService(
  slugsByProjectId: Record<string, string> = { project_1: 'skylane' },
): ProjectsService {
  return {
    async getDefaultProjectId() {
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
