# DomainProof

[![CI](https://github.com/iagodahlem/domainproof/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iagodahlem/domainproof/actions/workflows/ci.yml)

Prove ownership of a domain — domain verification as an API-first product.

## Monorepo

pnpm workspaces + Turborepo. Planned layout:

- `apps/web` — Next.js App Router dashboard (coming up)
- `apps/api` — Node/TS API server, Hono (coming up)
- `apps/docs` — public API docs, Fumadocs (coming up)
- `apps/demo` — interactive demo app (coming up)
- `packages/core` — domain verification core logic (coming up)
- `packages/sdk` — client SDK for the DomainProof API (coming up)
- `packages/cli` — command-line interface (coming up)
- `packages/mcp` — MCP server for agent integrations (coming up)

Production URLs: `app.domainproof.dev` (web), `api.domainproof.dev` (api),
`docs.domainproof.dev` (docs).

## Development

```bash
pnpm install
pnpm dev
pnpm test
```

The API's tests need a database: `docker compose up -d db` then, once,
`pnpm --filter api db:migrate`.

### Run with Docker

`docker compose up` starts the API (on port 3101) and Postgres. `pnpm dev`
remains the primary dev loop.

## API

Base URL: `api.domainproof.dev`. Every non-2xx response is
`{ error: { code, message } }`.

| Method | Path                    | Auth                  | Description                              |
| ------ | ----------------------- | ---------------------- | ----------------------------------------- |
| GET    | `/health`                | none                    | Liveness check; returns `{ status, version }`. |
| POST   | `/v1/keys`                | Clerk (dashboard)       | Creates an API key for the caller's project. |
| GET    | `/v1/keys`                | Clerk (dashboard)       | Lists the caller's project's API keys.    |
| POST   | `/v1/keys/:keyId/revoke`  | Clerk (dashboard)       | Revokes an API key.                       |
| POST   | `/v1/keys/:keyId/rotate`  | Clerk (dashboard)       | Revokes an API key and issues its replacement. |

"Clerk (dashboard)" means a `Authorization: Bearer <Clerk session JWT>`
header, verified against the configured Clerk JWKS/issuer — this is the
dashboard calling on behalf of a signed-in user, not the public verification
API (which will authenticate with `dp_<mode>_<keyId>_<secret>` API keys once
its endpoints land).

This table is maintained by hand until an OpenAPI spec exists — any PR that
adds or changes an endpoint must update it. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for the layer map and dependency rules.
