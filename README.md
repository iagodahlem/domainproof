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

The API has two authentication planes:

- **Dashboard API** — authenticated by the builder's login session
  (`Authorization: Bearer <session token>`). This is what the DomainProof
  dashboard calls on the signed-in builder's behalf; it's not meant to be
  called directly by integrations.
- **Public API** — authenticated with a project API key
  (`Authorization: Bearer dp_test_...` / `dp_live_...`). This is the plane
  the SDK, CLI, MCP server, and direct integrations use. No endpoints live
  here yet — domain verification (creating a domain, checking its status,
  triggering a recheck) is next.

| Method | Path                      | Plane     | Description                                    |
| ------ | ------------------------- | --------- | ----------------------------------------------- |
| GET    | `/health`                 | none      | Liveness check; returns `{ status, version }`.  |
| POST   | `/v1/keys`                | Dashboard | Creates an API key for the caller's project.    |
| GET    | `/v1/keys`                | Dashboard | Lists the caller's project's API keys.          |
| POST   | `/v1/keys/:keyId/revoke`  | Dashboard | Revokes an API key.                             |
| POST   | `/v1/keys/:keyId/rotate`  | Dashboard | Revokes an API key and issues its replacement.  |

This table is maintained by hand until an OpenAPI spec exists — any PR that
adds or changes an endpoint must update it. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for the layer map and dependency rules.
