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

### Run with Docker

`docker compose up` starts the API (on port 3101) and Postgres. `pnpm dev`
remains the primary dev loop.
