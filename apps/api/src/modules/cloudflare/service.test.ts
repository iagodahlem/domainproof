import { describe, expect, it } from 'vitest'
import type { DomainsService, DomainSummary } from '@modules/domains/service'
import type { DomainEventMap, DomainEventType, EventBus } from '@shared/events'
import { createCloudflareOAuthService } from './service'
import type { CloudflareClient } from './ports'

const CONFIG = {
  clientId: 'cf-client-id',
  clientSecret: 'cf-client-secret',
  redirectUri: 'https://verify.domainproof.dev/frontend/cloudflare/callback',
}

function domainSummary(overrides: Partial<DomainSummary> = {}): DomainSummary {
  return {
    id: 'domain_1',
    projectId: 'project_1',
    domain: 'dashboard.acme.co',
    mode: 'live',
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    verifiedAt: null,
    challenges: [
      {
        method: 'dns_txt',
        recordHost: '_acme-challenge.dashboard.acme.co',
        recordValue: 'acme-verify=abc123',
      },
    ],
    frontendToken: 'ftok_abc',
    lastCheck: null,
    externalId: null,
    ...overrides,
  }
}

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
      return domainSummary()
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

function fakeCloudflareClient(
  overrides: Partial<CloudflareClient> = {},
): CloudflareClient {
  return {
    async exchangeCode() {
      return { ok: true, accessToken: 'cf-access-token' }
    },
    async findZoneByName() {
      return { ok: true, zone: { id: 'zone_1', name: 'acme.co' } }
    },
    async createTxtRecord() {
      return { ok: true }
    },
    ...overrides,
  }
}

function fakeEventBus(): EventBus & {
  published: { type: DomainEventType; payload: unknown }[]
} {
  const published: { type: DomainEventType; payload: unknown }[] = []
  return {
    published,
    async publish(type, payload: DomainEventMap[DomainEventType]) {
      published.push({ type, payload })
    },
    subscribe() {},
  }
}

describe('buildAuthorizeUrl', () => {
  it('builds a Cloudflare authorize URL with PKCE and a signed state', () => {
    const service = createCloudflareOAuthService(
      CONFIG,
      fakeCloudflareClient(),
      fakeDomainsService(),
      fakeEventBus(),
    )

    const url = new URL(service.buildAuthorizeUrl('ftok_abc'))

    expect(url.origin + url.pathname).toBe(
      'https://dash.cloudflare.com/oauth2/auth',
    )
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe(CONFIG.clientId)
    expect(url.searchParams.get('redirect_uri')).toBe(CONFIG.redirectUri)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(url.searchParams.get('scope')).toBeTruthy()
  })

  it('produces a state round-trippable back to the same frontendToken via handleCallback', async () => {
    const service = createCloudflareOAuthService(
      CONFIG,
      fakeCloudflareClient(),
      fakeDomainsService(),
      fakeEventBus(),
    )

    const url = new URL(service.buildAuthorizeUrl('ftok_abc'))
    const state = url.searchParams.get('state') ?? ''

    const result = await service.handleCallback({ code: 'auth-code', state })

    expect(result).toEqual({
      ok: true,
      frontendToken: 'ftok_abc',
      outcome: 'success',
    })
  })
})

describe('handleCallback', () => {
  async function authorizeState(
    service: ReturnType<typeof createCloudflareOAuthService>,
    frontendToken = 'ftok_abc',
  ): Promise<string> {
    const url = new URL(service.buildAuthorizeUrl(frontendToken))
    return url.searchParams.get('state') ?? ''
  }

  it('happy path: exchanges the code, matches the zone, creates the record, publishes the event, and triggers verify', async () => {
    const eventBus = fakeEventBus()
    let verifyCalledWith: string | undefined
    const domainsService = fakeDomainsService({
      async verifyDomainByFrontendToken(token) {
        verifyCalledWith = token
        return {
          ok: true,
          domain: domainSummary(),
          check: {
            outcome: 'found',
            checkedAt: new Date(),
            expectedValue: 'acme-verify=abc123',
            detectedValues: ['acme-verify=abc123'],
          },
        }
      },
    })
    let createTxtRecordArgs: unknown
    const cloudflareClient = fakeCloudflareClient({
      async createTxtRecord(accessToken, zoneId, record) {
        createTxtRecordArgs = { accessToken, zoneId, record }
        return { ok: true }
      },
    })
    const service = createCloudflareOAuthService(
      CONFIG,
      cloudflareClient,
      domainsService,
      eventBus,
    )
    const state = await authorizeState(service)

    const result = await service.handleCallback({ code: 'auth-code', state })

    expect(result).toEqual({
      ok: true,
      frontendToken: 'ftok_abc',
      outcome: 'success',
    })
    expect(createTxtRecordArgs).toEqual({
      accessToken: 'cf-access-token',
      zoneId: 'zone_1',
      record: {
        name: '_acme-challenge.dashboard.acme.co',
        content: 'acme-verify=abc123',
      },
    })
    expect(eventBus.published).toHaveLength(1)
    expect(eventBus.published[0]).toMatchObject({
      type: 'domain.dns_autoconfigured',
      payload: {
        domainId: 'domain_1',
        provider: 'cloudflare',
        recordType: 'TXT',
      },
    })
    expect(verifyCalledWith).toBe('ftok_abc')
  })

  it('rejects a missing state with no redirect target', async () => {
    const service = createCloudflareOAuthService(
      CONFIG,
      fakeCloudflareClient(),
      fakeDomainsService(),
      fakeEventBus(),
    )

    const result = await service.handleCallback({ code: 'auth-code' })

    expect(result).toEqual({ ok: false, error: 'invalid_state' })
  })

  it('rejects a tampered state', async () => {
    const service = createCloudflareOAuthService(
      CONFIG,
      fakeCloudflareClient(),
      fakeDomainsService(),
      fakeEventBus(),
    )
    const state = await authorizeState(service)
    const tampered = `${state}tampered`

    const result = await service.handleCallback({
      code: 'auth-code',
      state: tampered,
    })

    expect(result).toEqual({ ok: false, error: 'invalid_state' })
  })

  it('reports denied when Cloudflare returns an error param, without exchanging a code', async () => {
    let exchangeCalled = false
    const cloudflareClient = fakeCloudflareClient({
      async exchangeCode() {
        exchangeCalled = true
        return { ok: true, accessToken: 'should-not-be-used' }
      },
    })
    const service = createCloudflareOAuthService(
      CONFIG,
      cloudflareClient,
      fakeDomainsService(),
      fakeEventBus(),
    )
    const state = await authorizeState(service)

    const result = await service.handleCallback({
      error: 'access_denied',
      state,
    })

    expect(result).toEqual({
      ok: true,
      frontendToken: 'ftok_abc',
      outcome: 'denied',
    })
    expect(exchangeCalled).toBe(false)
  })

  it('reports exchange_failed when the code exchange fails', async () => {
    const cloudflareClient = fakeCloudflareClient({
      async exchangeCode() {
        return { ok: false, error: 'exchange_failed' }
      },
    })
    const service = createCloudflareOAuthService(
      CONFIG,
      cloudflareClient,
      fakeDomainsService(),
      fakeEventBus(),
    )
    const state = await authorizeState(service)

    const result = await service.handleCallback({ code: 'bad-code', state })

    expect(result).toEqual({
      ok: true,
      frontendToken: 'ftok_abc',
      outcome: 'exchange_failed',
    })
  })

  it('reports not_found when the claim no longer resolves by frontendToken', async () => {
    const domainsService = fakeDomainsService({
      async getDomainByFrontendToken() {
        return null
      },
    })
    const service = createCloudflareOAuthService(
      CONFIG,
      fakeCloudflareClient(),
      domainsService,
      fakeEventBus(),
    )
    const state = await authorizeState(service)

    const result = await service.handleCallback({ code: 'auth-code', state })

    expect(result).toEqual({
      ok: true,
      frontendToken: 'ftok_abc',
      outcome: 'not_found',
    })
  })

  it('reports no_matching_zone when no zone matches the claim domain', async () => {
    const cloudflareClient = fakeCloudflareClient({
      async findZoneByName() {
        return { ok: false, error: 'not_found' }
      },
    })
    const service = createCloudflareOAuthService(
      CONFIG,
      cloudflareClient,
      fakeDomainsService(),
      fakeEventBus(),
    )
    const state = await authorizeState(service)

    const result = await service.handleCallback({ code: 'auth-code', state })

    expect(result).toEqual({
      ok: true,
      frontendToken: 'ftok_abc',
      outcome: 'no_matching_zone',
    })
  })

  it('reports record_create_failed when the TXT record write fails', async () => {
    const eventBus = fakeEventBus()
    const cloudflareClient = fakeCloudflareClient({
      async createTxtRecord() {
        return { ok: false, error: 'request_failed' }
      },
    })
    const service = createCloudflareOAuthService(
      CONFIG,
      cloudflareClient,
      fakeDomainsService(),
      eventBus,
    )
    const state = await authorizeState(service)

    const result = await service.handleCallback({ code: 'auth-code', state })

    expect(result).toEqual({
      ok: true,
      frontendToken: 'ftok_abc',
      outcome: 'record_create_failed',
    })
    expect(eventBus.published).toHaveLength(0)
  })

  it('never exposes the Cloudflare access token in its result', async () => {
    const service = createCloudflareOAuthService(
      CONFIG,
      fakeCloudflareClient(),
      fakeDomainsService(),
      fakeEventBus(),
    )
    const state = await authorizeState(service)

    const result = await service.handleCallback({ code: 'auth-code', state })

    expect(JSON.stringify(result)).not.toContain('cf-access-token')
  })
})
