import { afterEach, describe, expect, it, vi } from 'vitest'
import { DomainProof } from './client'
import { DomainProofApiError } from './errors'
import type { Domain } from './types'

const SAMPLE_DOMAIN: Domain = {
  id: 'dom_1',
  domain: 'acme.com',
  mode: 'test',
  status: 'pending',
  external_id: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  verifiedAt: null,
  verificationUrl: 'https://domainproof.dev/verify/tok_1',
  records: [
    {
      type: 'TXT',
      name: '_domainproof.acme.com',
      value: 'domainproof-verify=abc123',
      purpose: 'ownership',
      description: 'Proves control of acme.com.',
      status: 'pending',
    },
  ],
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn<
    (url: string, init: RequestInit) => Promise<Response>
  >(async () => jsonResponse(status, body))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** `noUncheckedIndexedAccess` makes `.mock.calls[0]` possibly-`undefined` — this asserts the call happened and hands back a properly typed tuple. */
function firstCall(fetchMock: ReturnType<typeof stubFetch>) {
  const call = fetchMock.mock.calls[0]
  if (!call) throw new Error('Expected fetch to have been called')
  return call
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DomainProof', () => {
  it('defaults baseUrl to the production api', async () => {
    const fetchMock = stubFetch(200, { domain: SAMPLE_DOMAIN })
    const client = new DomainProof({ apiKey: 'dp_test_key' })

    await client.domains.get('dom_1')

    const [url] = firstCall(fetchMock)
    expect(url).toBe('https://api.domainproof.dev/v1/domains/dom_1')
  })

  it('overrides baseUrl when provided', async () => {
    const fetchMock = stubFetch(200, { domain: SAMPLE_DOMAIN })
    const client = new DomainProof({
      apiKey: 'dp_test_key',
      baseUrl: 'http://localhost:3001',
    })

    await client.domains.get('dom_1')

    const [url] = firstCall(fetchMock)
    expect(url).toBe('http://localhost:3001/v1/domains/dom_1')
  })

  it('injects the api key as a bearer token on every request', async () => {
    const fetchMock = stubFetch(200, { domain: SAMPLE_DOMAIN })
    const client = new DomainProof({ apiKey: 'dp_test_abc123' })

    await client.domains.get('dom_1')

    const [, init] = firstCall(fetchMock)
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer dp_test_abc123')
  })

  describe('domains', () => {
    it('claims a domain', async () => {
      const fetchMock = stubFetch(201, { domain: SAMPLE_DOMAIN })
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.domains.claim({
        domain: 'acme.com',
        externalId: 'user_1',
      })

      expect(result.data).toEqual(SAMPLE_DOMAIN)
      const [url, init] = firstCall(fetchMock)
      expect(url).toBe('https://api.domainproof.dev/v1/domains')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body as string)).toEqual({
        domain: 'acme.com',
        external_id: 'user_1',
      })
    })

    it('lists domains', async () => {
      const fetchMock = stubFetch(200, {
        domains: [SAMPLE_DOMAIN],
        nextCursor: null,
      })
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.domains.list({
        limit: 10,
        externalId: 'user_1',
      })

      expect(result.data).toEqual({
        domains: [SAMPLE_DOMAIN],
        nextCursor: null,
      })
      const [url] = firstCall(fetchMock)
      expect(url).toBe(
        'https://api.domainproof.dev/v1/domains?limit=10&external_id=user_1',
      )
    })

    it('gets a domain', async () => {
      stubFetch(200, { domain: SAMPLE_DOMAIN })
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.domains.get('dom_1')

      expect(result.data).toEqual(SAMPLE_DOMAIN)
    })

    it('releases a domain', async () => {
      const fetchMock = stubFetch(200, { domain: SAMPLE_DOMAIN })
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.domains.release('dom_1')

      expect(result.data).toEqual(SAMPLE_DOMAIN)
      const [, init] = firstCall(fetchMock)
      expect(init.method).toBe('DELETE')
    })

    it('verifies a domain', async () => {
      const check = {
        outcome: 'found' as const,
        checkedAt: '2026-01-01T00:05:00.000Z',
      }
      const fetchMock = stubFetch(200, { domain: SAMPLE_DOMAIN, check })
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.domains.verify('dom_1')

      expect(result.data).toEqual({ domain: SAMPLE_DOMAIN, check })
      const [url, init] = firstCall(fetchMock)
      expect(url).toBe('https://api.domainproof.dev/v1/domains/dom_1/verify')
      expect(init.method).toBe('POST')
    })

    it('regenerates a challenge', async () => {
      const fetchMock = stubFetch(200, { domain: SAMPLE_DOMAIN })
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.domains.regenerate('dom_1')

      expect(result.data).toEqual(SAMPLE_DOMAIN)
      const [url] = firstCall(fetchMock)
      expect(url).toBe(
        'https://api.domainproof.dev/v1/domains/dom_1/regenerate',
      )
    })

    it('lists a domain’s events', async () => {
      const event = {
        id: 'evt_1',
        type: 'domain.claimed',
        mode: 'test' as const,
        payload: {},
        createdAt: '2026-01-01T00:00:00.000Z',
      }
      const fetchMock = stubFetch(200, { events: [event], nextCursor: null })
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.domains.listEvents('dom_1', { limit: 5 })

      expect(result.data).toEqual({ events: [event], nextCursor: null })
      const [url] = firstCall(fetchMock)
      expect(url).toBe(
        'https://api.domainproof.dev/v1/domains/dom_1/events?limit=5',
      )
    })
  })

  describe('componentSessions', () => {
    it('creates a session', async () => {
      const session = {
        sessionToken: 'sess_tok_1',
        expiresAt: '2026-01-01T01:00:00.000Z',
      }
      const fetchMock = stubFetch(201, session)
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.componentSessions.create({
        externalId: 'user_1',
      })

      expect(result.data).toEqual(session)
      const [url, init] = firstCall(fetchMock)
      expect(url).toBe('https://api.domainproof.dev/v1/component-sessions')
      expect(JSON.parse(init.body as string)).toEqual({ externalId: 'user_1' })
    })
  })

  describe('error mapping', () => {
    it('maps a 404 to a DomainProofApiError carrying the response code', async () => {
      stubFetch(404, {
        error: { code: 'not_found', message: 'Domain not found' },
      })
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.domains.get('missing')

      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(DomainProofApiError)
      expect(result.error?.code).toBe('not_found')
      expect(result.error?.message).toBe('Domain not found')
      expect(result.error?.status).toBe(404)
    })

    it('maps a 409 to a DomainProofApiError carrying the response code', async () => {
      stubFetch(409, {
        error: {
          code: 'domain_already_claimed',
          message: 'This domain is already claimed.',
        },
      })
      const client = new DomainProof({ apiKey: 'dp_test_key' })

      const result = await client.domains.claim({ domain: 'acme.com' })

      expect(result.data).toBeNull()
      expect(result.error?.code).toBe('domain_already_claimed')
    })
  })
})
