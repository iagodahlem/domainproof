/**
 * Library entrypoint — the transport-agnostic pieces a host that embeds
 * this server (rather than running it as a subprocess) needs: `createServer`
 * itself, and the Streamable HTTP transport for wiring it into a Fetch-API
 * HTTP handler. The stdio/npx distribution's own entrypoint is `cli.ts`
 * (the package's `bin`), which isn't re-exported here — running it as a
 * child process, not importing it, is the whole point of that transport.
 */
export { createServer } from './server'
export { WebStandardStreamableHTTPServerTransport } from './mcp-sdk'
