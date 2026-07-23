import { describe, expect, it, vi } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import type { DomainProof, VerifyDomainResult } from '@domainproof/sdk'
import { description, handler } from './verify-domain'

const RESULT: VerifyDomainResult = {
  domain: {
    id: 'dom_1',
    domain: 'acme.com',
    mode: 'test',
    status: 'verified',
    external_id: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:05:00.000Z',
    verifiedAt: '2026-01-01T00:05:00.000Z',
    verificationUrl: 'https://domainproof.dev/verify/tok_1',
    records: [],
  },
  check: { outcome: 'found', checkedAt: '2026-01-01T00:05:00.000Z' },
}

function makeClient(verify: DomainProof['domains']['verify']): DomainProof {
  return { domains: { verify } } as unknown as DomainProof
}

describe('verify_domain description', () => {
  it('tells agents to pace polling instead of calling back-to-back', () => {
    expect(description).toMatch(/wait at least 20-30 seconds/)
  })
})

describe('verify_domain handler', () => {
  it('triggers a check and returns the domain and check as structured JSON', async () => {
    const verify = vi.fn().mockResolvedValue({ data: RESULT, error: null })
    const client = makeClient(verify)

    const result = await handler(client, { domainId: 'dom_1' })

    expect(verify).toHaveBeenCalledWith('dom_1')
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    expect(JSON.parse((content as { text: string }).text)).toEqual(RESULT)
  })

  it('maps a rate_limited error to an MCP tool error', async () => {
    const verify = vi.fn().mockResolvedValue({
      data: null,
      error: new DomainProofApiError('rate_limited', 'Too many requests', 429),
    })
    const client = makeClient(verify)

    const result = await handler(client, { domainId: 'dom_1' })

    expect(result.isError).toBe(true)
    const [content] = result.content
    const parsed = JSON.parse((content as { text: string }).text)
    expect(parsed.error.code).toBe('rate_limited')
  })
})
