import type { DomainProof } from '@domainproof/sdk'
import type { CallToolResult, ToolAnnotations } from '../mcp-sdk'
import { errorResult, jsonResult } from '../tool-result'
import { domainId } from './shared-schemas'

export const name = 'regenerate_challenge'

export const description =
  'Issue a fresh verification challenge and DNS record for a pending or failed ' +
  'domain, restarting verification from scratch. The old record stops being ' +
  'checked, so publish the new one it returns. Fails with invalid_status if the ' +
  "domain is 'verified' or 'temporarily_failed'."

export const inputSchema = { domainId }

export const annotations: ToolAnnotations = {
  title: 'Regenerate challenge',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
}

type Args = { domainId: string }

export async function handler(
  client: DomainProof,
  args: Args,
): Promise<CallToolResult> {
  const { data, error } = await client.domains.regenerate(args.domainId)
  if (error) return errorResult(error)
  return jsonResult({ domain: data })
}
