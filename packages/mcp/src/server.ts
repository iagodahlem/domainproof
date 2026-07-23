import type { DomainProof } from '@domainproof/sdk'
import { McpServer } from './mcp-sdk'
import * as claimDomain from './tools/claim-domain'
import * as getDomain from './tools/get-domain'
import * as getSetupInstructions from './tools/get-setup-instructions'
import * as listDomainEvents from './tools/list-domain-events'
import * as listDomains from './tools/list-domains'
import * as regenerateChallenge from './tools/regenerate-challenge'
import * as verifyDomain from './tools/verify-domain'

const TOOLS = [
  claimDomain,
  listDomains,
  getDomain,
  verifyDomain,
  regenerateChallenge,
  listDomainEvents,
  getSetupInstructions,
]

/**
 * Builds the MCP server and registers every tool against `client`, without
 * connecting it to a transport — the caller wires that up (stdio today,
 * potentially another transport later) so this stays testable and
 * transport-agnostic.
 */
export function createServer(client: DomainProof, version: string): McpServer {
  const server = new McpServer({ name: 'domainproof', version })

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.annotations.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each tool's Args type is inferred from its own inputSchema; TOOLS is intentionally heterogeneous.
      (args: any) => tool.handler(client, args),
    )
  }

  return server
}
