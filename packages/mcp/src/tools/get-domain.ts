import type { DomainProof } from '@domainproof/sdk'
import type { CallToolResult, ToolAnnotations } from '../mcp-sdk'
import { errorResult, jsonResult } from '../tool-result'
import { domainId } from './shared-schemas'

export const name = 'get_domain'

export const description =
  'Get a single claimed domain by id — its current status, DNS record(s), and timestamps.'

export const inputSchema = { domainId }

export const annotations: ToolAnnotations = {
  title: 'Get domain',
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
}

type Args = { domainId: string }

export async function handler(
  client: DomainProof,
  args: Args,
): Promise<CallToolResult> {
  const { data, error } = await client.domains.get(args.domainId)
  if (error) return errorResult(error)
  return jsonResult({ domain: data })
}
