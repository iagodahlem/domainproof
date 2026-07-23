# @domainproof/mcp

An [MCP](https://modelcontextprotocol.io) server that lets an AI agent claim,
verify, and monitor domains through [DomainProof](https://domainproof.dev) —
no browser, no dashboard, just tool calls.

Every tool call maps to one [`@domainproof/sdk`](../sdk) method, and every
SDK `Result<T>` error becomes an MCP tool error with an actionable message
(bad key, not found, rate limit, ...). Runs two ways: hosted, over
Streamable HTTP — no install, no process to manage — or as a local
stdio/npx subprocess.

## Install

The hosted server at `mcp.domainproof.dev` is the primary way to use
this — for Claude Code:

```bash
claude mcp add --transport http domainproof https://mcp.domainproof.dev/mcp --header "Authorization: Bearer $DOMAINPROOF_API_KEY"
```

Or by hand, in any client that reads an MCP servers JSON config:

```json
{
  "mcpServers": {
    "domainproof": {
      "type": "http",
      "url": "https://mcp.domainproof.dev/mcp",
      "headers": {
        "Authorization": "Bearer dp_test_..."
      }
    }
  }
}
```

Every request needs `Authorization: Bearer <DomainProof API key>` — missing
or malformed, and the server 401s with a message pointing back here. A
valid-looking but wrong/revoked key isn't rejected at this layer: it
reaches a tool call, which fails the same way any other
`@domainproof/sdk` call with a bad key does (`invalid_api_key`, described
in the tool's own error result).

### Run it yourself instead (stdio/npx)

No hosted dependency, no network hop between the MCP process and the tool
call — useful offline, air-gapped, or if you'd rather run your own process:

```bash
claude mcp add domainproof -e DOMAINPROOF_API_KEY=dp_test_... -- npx -y @domainproof/mcp
```

Or by hand:

```json
{
  "mcpServers": {
    "domainproof": {
      "command": "npx",
      "args": ["-y", "@domainproof/mcp"],
      "env": {
        "DOMAINPROOF_API_KEY": "dp_test_..."
      }
    }
  }
}
```

#### Config

| Env var                | Required? | For                                                                                   |
| ---------------------- | --------- | ------------------------------------------------------------------------------------- |
| `DOMAINPROOF_API_KEY`  | Yes       | Fails fast with a setup message on startup if missing.                                |
| `DOMAINPROOF_BASE_URL` | No        | Defaults to the production API. Override for local dev, e.g. `http://localhost:3001`. |

## Getting a key

You'll need an API key from a DomainProof project — create one from your
dashboard, which mints a `dp_test_...` and a `dp_live_...` key together.
Use the `dp_test_...` key while you or your agent are getting the flow
right: test-mode keys only work against `.test` sandbox domains, which
never touch real DNS, so an agent can claim/verify/regenerate freely
without publishing anything for real. Switch to the `dp_live_...` key once
you're pointing it at a real domain.

## Tools

| Tool                     | Read-only? | Description                                                                                               |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| `claim_domain`           | No         | Claim a hostname for this project and issue its verification challenge.                                   |
| `list_domains`           | Yes        | List domains claimed under this project; filter by `externalId`/`domain`, paginate with `limit`/`cursor`. |
| `get_domain`             | Yes        | Get a single claimed domain by id.                                                                        |
| `verify_domain`          | No         | Trigger a fresh verification check; safe to poll until `status` leaves `pending`.                         |
| `regenerate_challenge`   | No         | Issue a fresh challenge and DNS record for a `pending`/`failed` domain.                                   |
| `list_domain_events`     | Yes        | A domain's event timeline (claimed, verified, failed, ...).                                               |
| `get_setup_instructions` | Yes        | The DNS record (type/host/value), current status, and hosted verification link for one domain.            |

Every tool returns concise JSON in its text content — no prose padding —
and every tool is annotated (`readOnlyHint`, `destructiveHint`,
`idempotentHint`, `openWorldHint`) so a client can reason about which
calls are safe to retry or run without confirmation.

## Local development

```bash
pnpm --filter mcp build
DOMAINPROOF_API_KEY=dp_test_... node packages/mcp/dist/cli.js
```

Point an MCP client's `command`/`args` at that built `dist/cli.js` to
exercise a local stdio build before publishing. `dist/index.js` is the
package's library entry (`createServer`, the Streamable HTTP transport) —
what `apps/api` imports to serve the hosted endpoint — not something you
run directly.
