import { z } from 'zod'
import type { DomainProof } from '@domainproof/sdk'
import type { CallToolResult, ToolAnnotations } from '../mcp-sdk'
import { errorResult, jsonResult } from '../tool-result'
import { cursor, limit } from './shared-schemas'

export const name = 'list_domains'

export const description =
  'List domains claimed under this project, most recently claimed first. ' +
  'Optionally filter by externalId or exact hostname; paginate with limit/cursor.'

export const inputSchema = {
  limit: limit(100),
  cursor,
  externalId: z
    .string()
    .min(1)
    .optional()
    .describe('Filter to domains claimed with this externalId.'),
  domain: z
    .string()
    .min(1)
    .optional()
    .describe('Filter to this exact hostname.'),
}

export const annotations: ToolAnnotations = {
  title: 'List domains',
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
}

type Args = {
  limit?: number
  cursor?: string
  externalId?: string
  domain?: string
}

export async function handler(
  client: DomainProof,
  args: Args,
): Promise<CallToolResult> {
  const { data, error } = await client.domains.list(args)
  if (error) return errorResult(error)
  return jsonResult(data)
}
