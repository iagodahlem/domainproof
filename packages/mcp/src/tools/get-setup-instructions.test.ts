import { describe, expect, it, vi } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import type { DomainProof, Domain } from '@domainproof/sdk'
import { handler } from './get-setup-instructions'

const PENDING_DOMAIN: Domain = {
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

function makeClient(get: DomainProof['domains']['get']): DomainProof {
  return { domains: { get } } as unknown as DomainProof
}

describe('get_setup_instructions handler', () => {
  it('shapes the record, status, and verification link for an agent to relay', async () => {
    const get = vi.fn().mockResolvedValue({ data: PENDING_DOMAIN, error: null })
    const client = makeClient(get)

    const result = await handler(client, { domainId: 'dom_1' })

    expect(get).toHaveBeenCalledWith('dom_1')
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    expect(JSON.parse((content as { text: string }).text)).toEqual({
      domainId: 'dom_1',
      hostname: 'acme.com',
      status: 'pending',
      record: {
        type: 'TXT',
        host: '_domainproof.acme.com',
        value: 'domainproof-verify=abc123',
        description: 'Proves control of acme.com.',
      },
      verificationUrl: 'https://domainproof.dev/verify/tok_1',
    })
  })

  it('returns a null record when the domain has none', async () => {
    const domain: Domain = { ...PENDING_DOMAIN, records: [] }
    const get = vi.fn().mockResolvedValue({ data: domain, error: null })
    const client = makeClient(get)

    const result = await handler(client, { domainId: 'dom_1' })

    const [content] = result.content
    const parsed = JSON.parse((content as { text: string }).text)
    expect(parsed.record).toBeNull()
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
