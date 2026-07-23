import { afterEach, describe, expect, it, vi } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import type { DomainProof, Domain } from '@domainproof/sdk'
import { Client, InMemoryTransport } from './mcp-sdk'
import { createServer } from './server'

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

async function connectedClient(domainProof: DomainProof) {
  const server = createServer(domainProof, '0.1.0')
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ])

  return client
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createServer', () => {
  it('registers exactly the seven DomainProof tools', async () => {
    const client = await connectedClient({} as DomainProof)

    const { tools } = await client.listTools()

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'claim_domain',
      'get_domain',
      'get_setup_instructions',
      'list_domain_events',
      'list_domains',
      'regenerate_challenge',
      'verify_domain',
    ])
  })

  it('marks read-only tools and mutating tools distinctly via annotations', async () => {
    const client = await connectedClient({} as DomainProof)

    const { tools } = await client.listTools()
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))

    expect(byName.list_domains?.annotations?.readOnlyHint).toBe(true)
    expect(byName.claim_domain?.annotations?.readOnlyHint).toBe(false)
    expect(byName.regenerate_challenge?.annotations?.destructiveHint).toBe(true)
  })

  it('routes a callTool request through to the wrapped sdk client', async () => {
    const get = vi.fn().mockResolvedValue({ data: SAMPLE_DOMAIN, error: null })
    const client = await connectedClient({
      domains: { get },
    } as unknown as DomainProof)

    const result = await client.callTool({
      name: 'get_domain',
      arguments: { domainId: 'dom_1' },
    })

    expect(get).toHaveBeenCalledWith('dom_1')
    expect(result.isError).toBeUndefined()
  })

  it('surfaces a mapped sdk error as an MCP tool error', async () => {
    const get = vi.fn().mockResolvedValue({
      data: null,
      error: new DomainProofApiError('not_found', 'Domain not found', 404),
    })
    const client = await connectedClient({
      domains: { get },
    } as unknown as DomainProof)

    const result = await client.callTool({
      name: 'get_domain',
      arguments: { domainId: 'missing' },
    })

    expect(result.isError).toBe(true)
  })
})
