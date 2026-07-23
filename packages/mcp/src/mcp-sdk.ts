/**
 * `@modelcontextprotocol/sdk` only exposes its high-level pieces (McpServer,
 * StdioServerTransport, ...) via deep subpaths that keep an explicit `.js`
 * suffix in the import specifier — that's how its own package `exports` map
 * resolves them, unlike this repo's relative imports (see
 * `eslint.base.mjs`'s extensionless-import rule). Re-exporting them all from
 * this one file keeps that unavoidable `.js` suffix confined to a single,
 * explicitly-exempted module (see `eslint.config.mjs`) instead of scattered
 * across every file that needs a type or class from the sdk.
 */
export { Client } from '@modelcontextprotocol/sdk/client/index.js'
export { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
export { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
export { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
export type {
  CallToolResult,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js'
