import { Hono } from 'hono'
import { DomainProof } from '@domainproof/sdk'
import {
  createServer,
  WebStandardStreamableHTTPServerTransport,
} from '@domainproof/mcp'
import { apiError } from '@shared/http-errors'

export interface McpRouterDeps {
  /**
   * Where the per-request `@domainproof/sdk` client sends its tool-call
   * requests. Defaults to `env.DOMAINPROOF_BASE_URL`, itself optional —
   * unset falls through to the SDK's own production default
   * (`https://api.domainproof.dev`), correct for this service's
   * production deploy.
   */
  baseUrl?: string
  /** Reported as the MCP server's version in its `initialize` response — same `apps/api` package version `GET /health` reports. */
  version: string
}

/**
 * The hosted MCP endpoint: a single Streamable HTTP route, `/mcp`,
 * answering every JSON-RPC method the `@domainproof/mcp` tool set
 * supports (list/call tools, ...). Stateless by design — no
 * `sessionIdGenerator`, so every request gets a fresh `McpServer` and
 * transport rather than a session pinned to one server process, which is
 * what makes this safe to run behind a load balancer with no sticky
 * routing or shared session store.
 *
 * Deliberately not wired against this service's own `modules/*` the way
 * every other plane is: the caller's `Authorization: Bearer <key>`
 * becomes the api key of a `@domainproof/sdk` client for the duration of
 * the request, and every tool call goes back out over HTTP to this same
 * service's own `/v1` plane (`baseUrl`, above) — reusing the exact
 * key-auth, rate-limiting, and error-taxonomy path any other SDK caller
 * gets, and the exact same tool set the stdio/npx distribution
 * (`packages/mcp`'s `cli.ts`) registers, instead of a second, in-process
 * mapping from MCP tool calls to module services that could drift from
 * it. This route never validates the key itself — a missing or malformed
 * `Authorization` header 401s here, but an invalid key surfaces as a
 * normal tool-call error once a tool actually calls the SDK, same as
 * every other `@domainproof/sdk` consumer (see `packages/mcp/src/errors.ts`).
 */
export function createMcpRouter(deps: McpRouterDeps) {
  const router = new Hono()

  router.all('/', async (c) => {
    const apiKey = extractBearerToken(c.req.header('Authorization'))
    if (!apiKey) {
      return c.json(
        apiError(
          'invalid_api_key',
          'Missing or invalid Authorization header. Send `Authorization: Bearer <DomainProof API key>` — create one from your DomainProof dashboard.',
        ),
        401,
      )
    }

    const client = new DomainProof({ apiKey, baseUrl: deps.baseUrl })
    const server = createServer(client, deps.version)
    const transport = new WebStandardStreamableHTTPServerTransport({
      // Stateless (see the doc comment above) — no session to keep an SSE
      // stream open for. Every tool this server registers is a single
      // quick request/response (no server-initiated progress
      // notifications), so a plain JSON reply per request is simpler for
      // both sides than negotiating and parsing an SSE stream for what's
      // always exactly one message.
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)

    return transport.handleRequest(c.req.raw)
  })

  return router
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : undefined
}
