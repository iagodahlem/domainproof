import { describe, expect, it, vi } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import type { DomainProof, Domain } from '@domainproof/sdk'
import { handler } from './regenerate-challenge'

const SAMPLE_DOMAIN: Domain = {
  id: 'dom_1',
  domain: 'acme.com',
  mode: 'test',
  status: 'pending',
  external_id: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:10:00.000Z',
  verifiedAt: null,
  verificationUrl: 'https://domainproof.dev/verify/tok_2',
  records: [
    {
      type: 'TXT',
      name: '_domainproof.acme.com',
      value: 'domainproof-verify=def456',
      purpose: 'ownership',
      description: 'Proves control of acme.com.',
      status: 'pending',
    },
  ],
}

function makeClient(
  regenerate: DomainProof['domains']['regenerate'],
): DomainProof {
  return { domains: { regenerate } } as unknown as DomainProof
}

describe('regenerate_challenge handler', () => {
  it('regenerates the challenge and returns the domain as structured JSON', async () => {
    const regenerate = vi
      .fn()
      .mockResolvedValue({ data: SAMPLE_DOMAIN, error: null })
    const client = makeClient(regenerate)

    const result = await handler(client, { domainId: 'dom_1' })

    expect(regenerate).toHaveBeenCalledWith('dom_1')
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    expect(JSON.parse((content as { text: string }).text)).toEqual({
      domain: SAMPLE_DOMAIN,
    })
  })

  it('maps an invalid_status error to an MCP tool error', async () => {
    const regenerate = vi.fn().mockResolvedValue({
      data: null,
      error: new DomainProofApiError(
        'invalid_status',
        'Only pending or failed domains can have their challenge regenerated.',
        409,
      ),
    })
    const client = makeClient(regenerate)

    const result = await handler(client, { domainId: 'dom_1' })

    expect(result.isError).toBe(true)
    const [content] = result.content
    const parsed = JSON.parse((content as { text: string }).text)
    expect(parsed.error.code).toBe('invalid_status')
  })
})
