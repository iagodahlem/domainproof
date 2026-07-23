import { describe, expect, it, vi } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import type { DomainProof, DomainPage } from '@domainproof/sdk'
import { handler } from './list-domains'

const PAGE: DomainPage = { domains: [], nextCursor: null }

function makeClient(list: DomainProof['domains']['list']): DomainProof {
  return { domains: { list } } as unknown as DomainProof
}

describe('list_domains handler', () => {
  it('passes filters through to the sdk and returns the page as structured JSON', async () => {
    const list = vi.fn().mockResolvedValue({ data: PAGE, error: null })
    const client = makeClient(list)

    const result = await handler(client, {
      limit: 10,
      externalId: 'user_1',
    })

    expect(list).toHaveBeenCalledWith({ limit: 10, externalId: 'user_1' })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    expect(JSON.parse((content as { text: string }).text)).toEqual(PAGE)
  })

  it('maps an invalid api key error to an MCP tool error', async () => {
    const list = vi.fn().mockResolvedValue({
      data: null,
      error: new DomainProofApiError('invalid_api_key', 'Invalid API key', 401),
    })
    const client = makeClient(list)

    const result = await handler(client, {})

    expect(result.isError).toBe(true)
    const [content] = result.content
    const parsed = JSON.parse((content as { text: string }).text)
    expect(parsed.error.code).toBe('invalid_api_key')
  })
})
