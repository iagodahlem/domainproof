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

|                            | URL                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Web (production)           | <https://domainproof.dev>                                                                     |
| Public API (production)    | <https://api.domainproof.dev> — serves `/v1/*` only                                           |
| Dashboard API (production) | `dashboard.api.domainproof.dev` — serves `/dashboard/*` only; pending DNS — being provisioned |
| Docs (production)          | <https://docs.domainproof.dev> — host-routed by the web app                                   |
| Demo (production)          | <https://demo.domainproof.dev> — host-routed by the web app                                   |

|          | Local (`pnpm dev`)      | Local (`docker compose up`)   |
| -------- | ----------------------- | ----------------------------- |
| Web      | <http://localhost:3000> | — (not in `compose.yaml` yet) |
| API      | <http://localhost:3001> | <http://localhost:3101>       |
| Postgres | `localhost:5432`        | `localhost:5432`              |

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

| Var                              | Required? | For                                                                                                                                                         |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | Yes       | Postgres connection string. The `.env.example` default matches `compose.yaml`'s `db` service.                                                               |
| `CLERK_JWKS_URL`, `CLERK_ISSUER` | No        | Session auth for the dashboard API. Unset means routes that need it (`/dashboard/*`) respond `500 auth_not_configured` instead of the app refusing to boot. |
| `PORT`                           | No        | Defaults to `3001`.                                                                                                                                         |
| `RESEND_API_KEY`                 | No        | Enables the email notification subscribers. Unset means they're never registered — the app boots and every request still works, just without emails sent.   |
| `EMAIL_FROM`                     | No        | Defaults to `DomainProof <notifications@domainproof.dev>`.                                                                                                  |
| `WEBHOOK_MAX_ATTEMPTS`           | No        | Total delivery attempts (including the first) before a webhook delivery is marked `failed` for good. Defaults to `5`.                                       |
| `RECHECK_ENABLED`                | No        | Defaults to `true`. Set to `false` to disable the background recheck scheduler (see [API](#api) below).                                                     |
| `RECHECK_INTERVAL_MS`            | No        | Defaults to `60000` (1 minute). How often the recheck scheduler ticks.                                                                                      |
| `RECHECK_BATCH_SIZE`             | No        | Defaults to `10`. How many domains each of a tick's two batches processes at most.                                                                          |

```bash
docker compose up -d db
pnpm --filter api db:migrate
pnpm dev
```

`pnpm test` also needs the database up and migrated, same as above.

To wipe and rebuild the local database from scratch, run `pnpm --filter api db:reset -- --yes` (refuses without `--yes` or `DB_RESET_CONFIRM=1`, and always prints the host it's about to reset).

To seed a demo account, a named project, and its test/live API keys for local testing, run `pnpm --filter api db:seed` (prints both keys once — save them, they're not retrievable afterward). Refuses to reseed an account that already exists, so run `db:reset` first if you want a fresh demo.

### Run with Docker

`docker compose up` starts the API (on port 3101) and Postgres. `pnpm dev`
remains the primary dev loop.

## API

Base URL: `api.domainproof.dev`. Every non-2xx response is
`{ error: { code, message } }`.

The API has two authentication planes, split by path prefix (see
[ARCHITECTURE.md](./ARCHITECTURE.md#route-planes)). In production, each
plane is also confined to its own host — `api.domainproof.dev` serves
`/v1/*` only, `dashboard.api.domainproof.dev` serves `/dashboard/*`
only — but locally and in the Railway service domain both stay reachable
on one origin, so the split below is what matters for local development:

- **Dashboard API** (`/dashboard/*`) — authenticated by the builder's login
  session (`Authorization: Bearer <session token>`). This is what the
  DomainProof dashboard calls on the signed-in builder's behalf; it's not
  meant to be called directly by integrations.
- **Public API** (`/v1/*`) — authenticated with a project API key
  (`Authorization: Bearer dp_test_...` / `dp_live_...`). This is the plane
  the SDK, CLI, MCP server, and direct integrations use for domain
  claiming and running the DNS check that verifies a claim; the dashboard
  exposes the same domain lifecycle under its own session-authenticated
  routes below.

| Method | Path                                                                                   | Plane     | Description                                                                                                             |
| ------ | -------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                                                                              | none      | Liveness check; returns `{ status, version }`.                                                                          |
| GET    | `/dashboard/projects`                                                                  | Dashboard | Lists the caller's projects (empty for a fresh account).                                                                |
| POST   | `/dashboard/projects`                                                                  | Dashboard | Creates a named project, minting its test and live API keys in one transaction and returning both one-time key strings. |
| PATCH  | `/dashboard/projects/:projectId`                                                       | Dashboard | Renames a project. The slug (and its verification records) never changes.                                               |
| POST   | `/dashboard/projects/:projectId/keys`                                                  | Dashboard | Creates another API key for the given project.                                                                          |
| GET    | `/dashboard/projects/:projectId/keys`                                                  | Dashboard | Lists the given project's API keys.                                                                                     |
| POST   | `/dashboard/projects/:projectId/keys/:keyId/revoke`                                    | Dashboard | Revokes an API key.                                                                                                     |
| POST   | `/dashboard/projects/:projectId/keys/:keyId/rotate`                                    | Dashboard | Revokes an API key and issues its replacement.                                                                          |
| POST   | `/dashboard/projects/:projectId/domains`                                               | Dashboard | Claims a domain for the given project and an explicit `mode`, issuing a challenge.                                      |
| GET    | `/dashboard/projects/:projectId/domains`                                               | Dashboard | Cursor-paginated list of the project's domains across both modes, newest first.                                         |
| GET    | `/dashboard/projects/:projectId/domains/:domainId`                                     | Dashboard | Gets a domain and its current verification record instructions.                                                         |
| POST   | `/dashboard/projects/:projectId/domains/:domainId/verify`                              | Dashboard | Runs the DNS check for a claim and returns the updated domain plus the check's outcome.                                 |
| POST   | `/dashboard/projects/:projectId/domains/:domainId/regenerate`                          | Dashboard | Issues a fresh challenge for a `pending` or `failed` domain, restarting verification.                                   |
| DELETE | `/dashboard/projects/:projectId/domains/:domainId`                                     | Dashboard | Releases a domain claim.                                                                                                |
| GET    | `/dashboard/projects/:projectId/domains/:domainId/events`                              | Dashboard | Cursor-paginated timeline of events published for a domain.                                                             |
| GET    | `/dashboard/projects/:projectId/events`                                                | Dashboard | Cursor-paginated events across all of the project's domains and both modes, newest first.                               |
| POST   | `/dashboard/projects/:projectId/webhooks`                                              | Dashboard | Creates a webhook endpoint for the given project; returns the signing secret once.                                      |
| GET    | `/dashboard/projects/:projectId/webhooks`                                              | Dashboard | Lists the given project's webhook endpoints.                                                                            |
| DELETE | `/dashboard/projects/:projectId/webhooks/:endpointId`                                  | Dashboard | Deletes a webhook endpoint.                                                                                             |
| POST   | `/dashboard/projects/:projectId/webhooks/:endpointId/disable`                          | Dashboard | Stops deliveries to an endpoint without deleting it.                                                                    |
| POST   | `/dashboard/projects/:projectId/webhooks/:endpointId/enable`                           | Dashboard | Resumes deliveries to a disabled endpoint.                                                                              |
| GET    | `/dashboard/projects/:projectId/webhooks/:endpointId/deliveries`                       | Dashboard | Cursor-paginated delivery log for an endpoint, newest first.                                                            |
| POST   | `/dashboard/projects/:projectId/webhooks/:endpointId/deliveries/:deliveryId/redeliver` | Dashboard | Fires a fresh delivery of a past delivery's event.                                                                      |
| POST   | `/v1/domains`                                                                          | Public    | Claims a domain for the key's project/mode and issues a challenge.                                                      |
| GET    | `/v1/domains`                                                                          | Public    | Lists domains claimed by the key's project/mode.                                                                        |
| GET    | `/v1/domains/:id`                                                                      | Public    | Gets a claimed domain and its current verification record(s).                                                           |
| DELETE | `/v1/domains/:id`                                                                      | Public    | Releases a domain claim.                                                                                                |
| POST   | `/v1/domains/:id/verify`                                                               | Public    | Runs the DNS check for a claim and returns the updated domain plus the check's outcome.                                 |
| POST   | `/v1/domains/:id/regenerate`                                                           | Public    | Issues a fresh challenge for a `pending` or `failed` domain, restarting verification.                                   |
| GET    | `/v1/domains/:id/events`                                                               | Public    | Cursor-paginated timeline of events published for a domain (claimed, checks, transitions).                              |

This table is maintained by hand until an OpenAPI spec exists — any PR that
adds or changes an endpoint must update it. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for the layer map and dependency rules.

`POST /v1/domains/:id/verify` re-runs the check every time it's called
(safe to poll) and always returns a `check` object alongside the domain:

```json
{
  "domain": { "id": "...", "status": "pending", "records": ["..."] },
  "check": {
    "outcome": "not_found",
    "checkedAt": "2026-07-19T12:00:00.000Z",
    "explanation": "No record found yet. DNS changes usually take a few minutes to appear — we checked example.com's own nameservers to skip stale caches. Try verifying again shortly."
  }
}
```

`outcome` is one of `found` (verified), `wrong_value` (a record exists but
doesn't match — the response also carries `expected`/`detected`),
`not_found`, `unreachable`, or `expired` (a still-`pending` domain's
72-hour verification window closed before a correct record ever showed up
— claim it again for a fresh code). `not_found`, `unreachable`, and
`expired` all carry a plain-language `explanation` instead.

A domain's `verifiedAt` is "last confirmed good", not "first verified" — it
updates on every passing check (including a no-op recheck of an
already-verified domain), not just the first one.

Calling `POST /v1/domains/:id/verify` is optional — a background scheduler
(`apps/api/src/workers/`) re-checks every domain on its own, so
polling isn't required to eventually reflect a fixed record. It runs the
exact same check/transition/publish path as the endpoint above, on a
per-status cadence: a `pending` domain backs off 1m, 5m, 15m, 1h, then
every 6h; a `verified` domain gets a slow 24h continuous re-check; a
`temporarily_failed` domain (the 72h grace window after a `verified`
domain loses its record) is re-checked every 15m and expires to `failed`
if the window closes without recovering.

Claiming a `.test` sandbox domain (see the domains module's DNS testing
fixtures) requires a test-mode key; a live-mode key gets
`400 sandbox_requires_test_mode`.

`GET /v1/domains/:id/events` returns a domain's full timeline, oldest
first — every `domain.claimed`/`domain.check_passed`/`domain.check_failed`/
`domain.verified`/`domain.temporarily_failed`/`domain.failed` event
published for it:

```json
{
  "events": [
    {
      "id": "...",
      "type": "domain.claimed",
      "mode": "test",
      "payload": { "...": "..." },
      "createdAt": "2026-07-19T12:00:00.000Z"
    }
  ],
  "nextCursor": "eyJpZCI6Ii4uLiJ9"
}
```

Paginated with `?limit=` (default 20, max 100) and `?cursor=`, the opaque
`nextCursor` from the previous page; `nextCursor` is `null` once there's
nothing left to fetch.

The dashboard's domain routes (`GET /dashboard/projects/:projectId/domains`,
`/:domainId`, `/:domainId/events`) are read-only mirrors of the same domains
module for the dashboard's own pages — no claim/release/verify there, that
stays on `/v1/domains`. The list spans both `test` and `live` claims for the
project (`mode` is a field on each row, not something to filter by), newest
first, cursor-paginated the same way as `/v1/domains/:id/events` above
(`?limit=`/`?cursor=`, default 20, max 100). `:domainId` follows the same
anti-enumeration 404 as `:projectId` and `:keyId` elsewhere on this plane —
a domain belonging to another project reads as not found, not forbidden.

### Webhooks

A project's webhook endpoints (`POST /dashboard/projects/:projectId/webhooks`)
subscribe to a non-empty subset of the project-scoped event types:
`domain.claimed`, `domain.check_passed`, `domain.check_failed`,
`domain.verified`, `domain.temporarily_failed`, `domain.failed` (every
`DomainEventMap` entry except `account.created`, which isn't scoped to a
project). Creating an endpoint returns its signing secret (`whsec_...`)
exactly once — every later response only shows a masked form
(`whsec_...ab12`). `:projectId` follows the same anti-enumeration 404 as
elsewhere on this plane — a project belonging to another account reads as
not found, not forbidden, and once resolved, so does an `:endpointId`/
`:deliveryId` belonging to a different project.

Each subscribed event is delivered as an HTTP `POST` with this JSON body:

```json
{
  "id": "5c3b8f2e-...",
  "type": "domain.verified",
  "created_at": "2026-07-19T12:00:00.000Z",
  "data": {
    "domainId": "...",
    "projectId": "...",
    "mode": "live",
    "domain": "example.com"
  }
}
```

`data` is the event's own payload (see `shared/events.ts`'s
`DomainEventMap`) — it always carries `mode`, so a single endpoint
subscribed across both test and live keys can tell which is which.

Every delivery carries three headers alongside `content-type:
application/json`:

| Header                          | Value                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `domainproof-webhook-id`        | The delivery's id — stable across retries of the same delivery, so a receiver can dedupe. |
| `domainproof-webhook-timestamp` | Unix seconds at send time.                                                                |
| `domainproof-webhook-signature` | `sha256=<hex hmac>`, computed as below.                                                   |

To verify a delivery, recompute the signature over
`"<timestamp>.<raw body>"` with the endpoint's signing secret and compare
it to the header, in constant time:

```js
import { createHmac, timingSafeEqual } from 'node:crypto'

function verify(secret, timestamp, rawBody, signatureHeader) {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')
  const expected = `sha256=${digest}`
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  return a.length === b.length && timingSafeEqual(a, b)
}
```

A failed delivery (a non-2xx response, a timeout, or a connection error)
retries with backoff — 1 min, 5 min, 30 min, then 2 hours — up to
`WEBHOOK_MAX_ATTEMPTS` total attempts (default 5), after which it's marked
`failed` for good. `GET
/dashboard/projects/:projectId/webhooks/:endpointId/deliveries` returns the
delivery log (newest first, cursor-paginated); `POST
.../deliveries/:deliveryId/redeliver` fires the same event again as a
fresh delivery (a new log entry, attempt 1) without touching the original.

Delivery is fire-and-forget from the api's perspective — publishing an
event (a domain claim, a verify call, ...) never waits on a webhook
endpoint's response, so a slow or unreachable integrator endpoint can't
slow down the request that triggered it. Retries are an in-process
`setTimeout` schedule, not a durable queue — a scheduled retry is lost if
the api process restarts before it fires. That's an acceptable tradeoff
for a demoable product; a real queue (SQS, pg-boss, ...) is the
production-grade answer, same tradeoff the event bus itself makes.
