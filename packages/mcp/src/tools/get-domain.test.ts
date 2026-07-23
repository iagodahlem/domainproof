import { describe, expect, it, vi } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import type { DomainProof, Domain } from '@domainproof/sdk'
import { handler } from './get-domain'

const SAMPLE_DOMAIN: Domain = {
  id: 'dom_1',
  domain: 'acme.com',
  mode: 'test',
  status: 'verified',
  external_id: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  verifiedAt: '2026-01-01T00:05:00.000Z',
  verificationUrl: 'https://domainproof.dev/verify/tok_1',
  records: [],
}

function makeClient(get: DomainProof['domains']['get']): DomainProof {
  return { domains: { get } } as unknown as DomainProof
}

describe('get_domain handler', () => {
  it('returns the domain as structured JSON', async () => {
    const get = vi.fn().mockResolvedValue({ data: SAMPLE_DOMAIN, error: null })
    const client = makeClient(get)

    const result = await handler(client, { domainId: 'dom_1' })

    expect(get).toHaveBeenCalledWith('dom_1')
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    expect(JSON.parse((content as { text: string }).text)).toEqual({
      domain: SAMPLE_DOMAIN,
    })
  })

  it('maps a not_found error to an MCP tool error', async () => {
    const get = vi.fn().mockResolvedValue({
      data: null,
      error: new DomainProofApiError('not_found', 'Domain not found', 404),
    })
    const client = makeClient(get)

    const result = await handler(client, { domainId: 'missing' })

    expect(result.isError).toBe(true)
    const [content] = result.content
    const parsed = JSON.parse((content as { text: string }).text)
    expect(parsed.error.code).toBe('not_found')
  })
})
