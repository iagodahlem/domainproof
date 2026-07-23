import { describe, expect, it, vi } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import type { DomainProof, EventPage } from '@domainproof/sdk'
import { handler } from './list-domain-events'

const PAGE: EventPage = {
  events: [
    {
      id: 'evt_1',
      type: 'domain.claimed',
      mode: 'test',
      payload: {},
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  nextCursor: null,
}

function makeClient(
  listEvents: DomainProof['domains']['listEvents'],
): DomainProof {
  return { domains: { listEvents } } as unknown as DomainProof
}

describe('list_domain_events handler', () => {
  it('passes pagination through to the sdk and returns the page as structured JSON', async () => {
    const listEvents = vi.fn().mockResolvedValue({ data: PAGE, error: null })
    const client = makeClient(listEvents)

    const result = await handler(client, { domainId: 'dom_1', limit: 5 })

    expect(listEvents).toHaveBeenCalledWith('dom_1', {
      limit: 5,
      cursor: undefined,
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    expect(JSON.parse((content as { text: string }).text)).toEqual(PAGE)
  })

  it('maps a not_found error to an MCP tool error', async () => {
    const listEvents = vi.fn().mockResolvedValue({
      data: null,
      error: new DomainProofApiError('not_found', 'Domain not found', 404),
    })
    const client = makeClient(listEvents)

    const result = await handler(client, { domainId: 'missing' })

    expect(result.isError).toBe(true)
    const [content] = result.content
    const parsed = JSON.parse((content as { text: string }).text)
    expect(parsed.error.code).toBe('not_found')
  })
})
