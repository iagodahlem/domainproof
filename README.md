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

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layer map and dependency
rules.

## Environments

| | URL |
| --- | --- |
| Web (production) | <https://domainproof.dev> |
| API (production) | <https://api.domainproof.dev> |
| Docs (production) | <https://docs.domainproof.dev> — host-routed by the web app |
| Demo (production) | <https://demo.domainproof.dev> — host-routed by the web app |

| | Local (`pnpm dev`) | Local (`docker compose up`) |
| --- | --- | --- |
| Web | <http://localhost:3000> | — (not in `compose.yaml` yet) |
| API | <http://localhost:3001> | <http://localhost:3101> |
| Postgres | `localhost:5432` | `localhost:5432` |

## Local development

Prerequisites: Node 22, pnpm via [corepack](https://pnpm.io/installation#using-corepack)
(pinned to 9.7.0 by `packageManager` in `package.json`), Docker (for a local
Postgres).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` (`pnpm --filter api dev` loads it automatically via
`node`'s `--env-file-if-exists` flag — no shell exports needed, and
nothing breaks if the file doesn't exist):

| Var | Required? | For |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. The `.env.example` default matches `compose.yaml`'s `db` service. |
| `CLERK_JWKS_URL`, `CLERK_ISSUER` | No | Session auth for the dashboard API. Unset means routes that need it (`/dashboard/*`) respond `500 auth_not_configured` instead of the app refusing to boot. |
| `PORT` | No | Defaults to `3001`. |

```bash
docker compose up -d db
pnpm --filter api db:migrate
pnpm dev
```

`pnpm test` also needs the database up and migrated, same as above.

### Run with Docker

`docker compose up` starts the API (on port 3101) and Postgres. `pnpm dev`
remains the primary dev loop.

## API

Base URL: `api.domainproof.dev`. Every non-2xx response is
`{ error: { code, message } }`.

The API has two authentication planes, split by path prefix (see
[ARCHITECTURE.md](./ARCHITECTURE.md#route-planes)):

- **Dashboard API** (`/dashboard/*`) — authenticated by the builder's login
  session (`Authorization: Bearer <session token>`). This is what the
  DomainProof dashboard calls on the signed-in builder's behalf; it's not
  meant to be called directly by integrations.
- **Public API** (`/v1/*`) — authenticated with a project API key
  (`Authorization: Bearer dp_test_...` / `dp_live_...`). This is the plane
  the SDK, CLI, MCP server, and direct integrations use. No endpoints live
  here yet — domain verification (creating a domain, checking its status,
  triggering a recheck) is next.

| Method | Path                          | Plane     | Description                                    |
| ------ | ----------------------------- | --------- | ----------------------------------------------- |
| GET    | `/health`                     | none      | Liveness check; returns `{ status, version }`.  |
| POST   | `/dashboard/keys`             | Dashboard | Creates an API key for the caller's project.    |
| GET    | `/dashboard/keys`             | Dashboard | Lists the caller's project's API keys.          |
| POST   | `/dashboard/keys/:keyId/revoke` | Dashboard | Revokes an API key.                           |
| POST   | `/dashboard/keys/:keyId/rotate` | Dashboard | Revokes an API key and issues its replacement. |

This table is maintained by hand until an OpenAPI spec exists — any PR that
adds or changes an endpoint must update it. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for the layer map and dependency rules.
