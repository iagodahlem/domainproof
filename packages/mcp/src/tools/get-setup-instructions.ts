import type { DomainProof } from '@domainproof/sdk'
import type { CallToolResult, ToolAnnotations } from '../mcp-sdk'
import { errorResult, jsonResult } from '../tool-result'
import { domainId } from './shared-schemas'

export const name = 'get_setup_instructions'

export const description =
  'Get everything needed to finish setting up a claimed domain: the DNS record ' +
  'to publish (type/host/value), the current verification status, and the ' +
  'hosted verification link (for handing off to someone else to publish the ' +
  'record themselves).'

export const inputSchema = { domainId }

export const annotations: ToolAnnotations = {
  title: 'Get setup instructions',
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

  const [record] = data.records
  return jsonResult({
    domainId: data.id,
    hostname: data.domain,
    status: data.status,
    record: record
      ? {
          type: record.type,
          host: record.name,
          value: record.value,
          description: record.description,
        }
      : null,
    verificationUrl: data.verificationUrl,
  })
}
