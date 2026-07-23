import type { DomainProof } from '@domainproof/sdk'
import type { CallToolResult, ToolAnnotations } from '../mcp-sdk'
import { errorResult, jsonResult } from '../tool-result'
import { cursor, domainId, limit } from './shared-schemas'

export const name = 'list_domain_events'

export const description =
  "A domain's event timeline (claimed, verified, failed, ...), most recent first. " +
  'Useful for explaining why a domain is in its current status.'

export const inputSchema = { domainId, limit: limit(100), cursor }

export const annotations: ToolAnnotations = {
  title: 'List domain events',
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
}

type Args = { domainId: string; limit?: number; cursor?: string }

export async function handler(
  client: DomainProof,
  args: Args,
): Promise<CallToolResult> {
  const { data, error } = await client.domains.listEvents(args.domainId, {
    limit: args.limit,
    cursor: args.cursor,
  })
  if (error) return errorResult(error)
  return jsonResult(data)
}
