import type { DomainProofApiError } from '@domainproof/sdk'
import { describeError } from './errors'
import type { CallToolResult } from './mcp-sdk'

/** Wraps a JSON-serializable payload as a tool result — concise structured data, no prose. */
export function jsonResult(payload: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  }
}

/** Maps a `DomainProofApiError` to an MCP tool error result with an actionable message. */
export function errorResult(error: DomainProofApiError): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: {
            code: error.code,
            message: describeError(error),
            status: error.status,
          },
        }),
      },
    ],
  }
}
