import { describe, expect, it, vi } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import type { DomainProof, Domain } from '@domainproof/sdk'
import { handler } from './claim-domain'

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

function makeClient(claim: DomainProof['domains']['claim']): DomainProof {
  return { domains: { claim } } as unknown as DomainProof
}

describe('claim_domain handler', () => {
  it('claims the domain and returns it as structured JSON', async () => {
    const claim = vi
      .fn()
      .mockResolvedValue({ data: SAMPLE_DOMAIN, error: null })
    const client = makeClient(claim)

    const result = await handler(client, {
      hostname: 'acme.com',
      externalId: 'user_1',
    })

    expect(claim).toHaveBeenCalledWith({
      domain: 'acme.com',
      externalId: 'user_1',
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    expect(JSON.parse((content as { text: string }).text)).toEqual({
      domain: SAMPLE_DOMAIN,
    })
  })

  it('maps a domain_already_claimed error to an MCP tool error', async () => {
    const claim = vi.fn().mockResolvedValue({
      data: null,
      error: new DomainProofApiError(
        'domain_already_claimed',
        'This domain is already claimed for this project.',
        409,
      ),
    })
    const client = makeClient(claim)

    const result = await handler(client, { hostname: 'acme.com' })

    expect(result.isError).toBe(true)
    const [content] = result.content
    const parsed = JSON.parse((content as { text: string }).text)
    expect(parsed.error.code).toBe('domain_already_claimed')
  })
})
