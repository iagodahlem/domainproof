import type { DomainProof } from '@domainproof/sdk'
import type { CallToolResult, ToolAnnotations } from '../mcp-sdk'
import { errorResult, jsonResult } from '../tool-result'
import { domainId } from './shared-schemas'

export const name = 'verify_domain'

export const description =
  "Trigger a fresh verification check against a domain's current challenge " +
  'record and return the (possibly updated) domain alongside the check that ' +
  'produced it. Safe to call repeatedly — poll it after claim_domain until ' +
  "domain.status leaves 'pending'. DNS checks don't change second-to-second — " +
  'wait at least 20-30 seconds between calls rather than polling back-to-back.'

export const inputSchema = { domainId }

export const annotations: ToolAnnotations = {
  title: 'Verify domain',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
}

type Args = { domainId: string }

export async function handler(
  client: DomainProof,
  args: Args,
): Promise<CallToolResult> {
  const { data, error } = await client.domains.verify(args.domainId)
  if (error) return errorResult(error)
  return jsonResult(data)
}
