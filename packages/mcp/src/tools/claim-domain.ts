import { z } from 'zod'
import type { DomainProof } from '@domainproof/sdk'
import type { CallToolResult, ToolAnnotations } from '../mcp-sdk'
import { errorResult, jsonResult } from '../tool-result'

export const name = 'claim_domain'

export const description =
  'Claim a hostname for this project and issue its verification challenge. ' +
  'Returns the claimed domain, including the DNS record (type/host/value) to ' +
  'publish next — call get_setup_instructions or verify_domain afterward. Fails ' +
  'with domain_already_claimed if another project already holds an active claim ' +
  'on this hostname.'

export const inputSchema = {
  hostname: z
    .string()
    .min(1)
    .describe(
      "The hostname to claim, e.g. 'acme.com' or a subdomain like 'app.acme.com'. Use a '.test' hostname against a test-mode api key to exercise the sandbox resolver.",
    ),
  externalId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Your own identifier for whoever owns this domain (a user or org id) — not interpreted by DomainProof, just carried through for correlation and filtering with list_domains.',
    ),
}

export const annotations: ToolAnnotations = {
  title: 'Claim domain',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
}

type Args = { hostname: string; externalId?: string }

export async function handler(
  client: DomainProof,
  args: Args,
): Promise<CallToolResult> {
  const { data, error } = await client.domains.claim({
    domain: args.hostname,
    externalId: args.externalId,
  })
  if (error) return errorResult(error)
  return jsonResult({ domain: data })
}
