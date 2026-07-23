# DomainProof

[![CI](https://github.com/iagodahlem/domainproof/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iagodahlem/domainproof/actions/workflows/ci.yml)

Prove ownership of a domain — domain verification as an API-first product.

## Monorepo

pnpm workspaces + Turborepo, `catalog:` version pins in the root
`package.json`.

- `apps/web` — Next.js 15 (App Router). Serves the landing page and project
  dashboard at the apex domain (project routes live at the root, e.g.
  `/<projectId>/...`, not under a `/dashboard` prefix), the hosted
  verification portal at `/verify/[token]`, and docs (Fumadocs) at `/docs`
- `apps/api` — Hono REST API on `api.domainproof.dev`
- `packages/core` — pure domain logic: state machine, verification checks,
  DNS resolver interfaces. Consumed by `apps/api`
- `packages/sdk` — typed public-API client
- `packages/cli` — command-line interface
- `packages/mcp` — MCP server for agent integrations
- `packages/ui` — shared design-system primitives (tokens, components)
  consumed by `apps/web`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layer map and dependency
rules.

## Environments

|                            | URL                                                                 |
| -------------------------- | ------------------------------------------------------------------- |
| Web (production)           | <https://domainproof.dev>                                           |
| Public API (production)    | <https://api.domainproof.dev> — serves `/v1/*` only                 |
| Dashboard API (production) | `dashboard.api.domainproof.dev` — serves `/dashboard/*` only (live) |
| Frontend API (production)  | `frontend.api.domainproof.dev` — serves `/frontend/*` only (live)   |
| Hosted MCP (production)    | <https://mcp.domainproof.dev/mcp> — serves `/mcp` only              |
| Docs (production)          | <https://domainproof.dev/docs> — served by the web app              |
| Demo (production)          | <https://domainproof.dev/demo> — served by the web app              |

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
cp apps/web/.env.example apps/web/.env.local
```

`apps/web/.env.local`'s Clerk keys and `apps/api/.env`'s `CLERK_JWKS_URL`/
`CLERK_ISSUER` must come from the same Clerk instance, with
`NEXT_PUBLIC_API_URL` pointed at the api configured with that instance —
locally that's normally one dev instance for both, with `CLERK_JWKS_URL`
following the pattern `https://<instance-domain>/.well-known/jwks.json`.

`apps/api/.env` (`pnpm --filter api dev` loads it automatically via
`node`'s `--env-file-if-exists` flag — no shell exports needed, and
nothing breaks if the file doesn't exist):

| Var                                                                          | Required? | For                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                               | Yes       | Postgres connection string. The `.env.example` default matches `compose.yaml`'s `db` service.                                                                                                                                                                                     |
| `CLERK_JWKS_URL`, `CLERK_ISSUER`                                             | No        | Session auth for the dashboard API. Unset means routes that need it (`/dashboard/*`) respond `500 auth_not_configured` instead of the app refusing to boot.                                                                                                                       |
| `WEB_ORIGIN`                                                                 | No        | The dashboard web app's origin, for the dashboard plane's CORS policy — the only plane a browser calls directly. Unset allows any origin.                                                                                                                                         |
| `PUBLIC_API_HOST`, `DASHBOARD_API_HOST`, `FRONTEND_API_HOST`, `MCP_API_HOST` | No        | Production-only host restriction, one per plane plus the hosted MCP endpoint (see [API](#api) below). Unset means no restriction — local dev and tests reach every plane on one origin.                                                                                           |
| `DOMAINPROOF_BASE_URL`                                                       | No        | Where the hosted MCP endpoint's per-request SDK client sends tool-call requests — this same service's own `/v1` plane. Unset defaults to the SDK's own production default (`https://api.domainproof.dev`), correct in production; override locally, e.g. `http://localhost:3001`. |
| `PORT`                                                                       | No        | Defaults to `3001`.                                                                                                                                                                                                                                                               |
| `RESEND_API_KEY`                                                             | No        | Enables the email notification subscribers. Unset means they're never registered — the app boots and every request still works, just without emails sent.                                                                                                                         |
| `EMAIL_FROM`                                                                 | No        | Defaults to `DomainProof <notifications@domainproof.dev>`.                                                                                                                                                                                                                        |
| `WEBHOOK_MAX_ATTEMPTS`                                                       | No        | Total delivery attempts (including the first) before a webhook delivery is marked `failed` for good. Defaults to `5`.                                                                                                                                                             |
| `RECHECK_ENABLED`                                                            | No        | Defaults to `true`. Set to `false` to disable the background recheck scheduler (see [API](#api) below).                                                                                                                                                                           |
| `RECHECK_INTERVAL_MS`                                                        | No        | Defaults to `60000` (1 minute). How often the recheck scheduler ticks.                                                                                                                                                                                                            |
| `RECHECK_BATCH_SIZE`                                                         | No        | Defaults to `10`. How many domains each of a tick's two batches processes at most.                                                                                                                                                                                                |
| `CLOUDFLARE_OAUTH_CLIENT_ID`, `CLOUDFLARE_OAUTH_CLIENT_SECRET`               | No        | Private OAuth client credentials for the Cloudflare one-click DNS setup flow (see [Cloudflare one-click DNS setup](#cloudflare-one-click-dns-setup) below). Both unset means the routes respond `404 not_configured` instead of the app refusing to boot.                         |
| `CLOUDFLARE_OAUTH_REDIRECT_URI`                                              | No        | Overrides the redirect URI the api sends Cloudflare during the one-click DNS setup flow, for staging/preview environments running under their own host. Unset defaults to the production frontend-API callback URL.                                                               |

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

### Web

`apps/web` (`pnpm --filter web dev`, default <http://localhost:3000>) hosts
the hosted verification page at `/verify/[token]` — the unauthenticated,
token-scoped page a domain owner lands on from a claim's `verificationUrl`.
It reads and polls the Frontend API plane directly from the browser (see
[Frontend API](#frontend-api) below), never through a Next.js route
handler, and has no auth context of its own. Set `NEXT_PUBLIC_FRONTEND_API_URL`
(`apps/web/.env.example`) to that plane's base URL — it defaults to
`http://localhost:3001` for local dev and should be set to
`https://frontend.api.domainproof.dev` in production.

## API

Base URL: `api.domainproof.dev`. Every non-2xx response is
`{ error: { code, message } }`.

The API has three authentication planes, split by path prefix (see
[ARCHITECTURE.md](./ARCHITECTURE.md#route-planes)). In production, each
plane is also confined to its own host — `api.domainproof.dev` serves
`/v1/*` only, `dashboard.api.domainproof.dev` serves `/dashboard/*`
only, `frontend.api.domainproof.dev` serves `/frontend/*` only — but locally
and in the Railway service domain all three stay reachable on one origin,
so the split below is what matters for local development:

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
- **Frontend API** (`/frontend/*`) — named after Clerk's FAPI: it serves
  the builder's _customers_ and DomainProof's own frontends, not the
  builder themselves. No session, no api key — each domain claim carries
  its own unguessable `frontendToken`, embedded directly in
  `verificationUrl`, that grants read access plus a rate-limited re-check
  on that one claim and nothing else. This is what the hosted verification
  page calls, and what a drop-in component calls after a component session
  (minted on `/v1`) hands it a domain claim of its own. See "Frontend API"
  below.

A fourth host, `mcp.domainproof.dev`, answers `/mcp` only — the hosted
[`@domainproof/mcp`](./packages/mcp) server (Streamable HTTP), the primary
way an AI agent uses DomainProof. It isn't a fourth authentication plane:
it authenticates nothing itself. The caller's `Authorization: Bearer
<key>` is forwarded as-is to a fresh `@domainproof/sdk` client for the
request, which calls back into this same service's own `/v1` plane over
HTTP — a missing/malformed header 401s at `/mcp` directly, but a
wrong/revoked key surfaces as a normal tool-call error from that `/v1`
round trip instead, same as any other SDK caller. See
[`packages/mcp`](./packages/mcp)'s README for tool docs and both
transports (hosted HTTP and local stdio/npx).

| Method | Path                                                                                   | Plane     | Description                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                                                                              | none      | Liveness check; returns `{ status, version }`.                                                                                      |
| GET    | `/dashboard/projects`                                                                  | Dashboard | Lists the caller's projects (empty for a fresh account).                                                                            |
| POST   | `/dashboard/projects`                                                                  | Dashboard | Creates a named project, minting its test and live API keys in one transaction and returning both one-time key strings.             |
| PATCH  | `/dashboard/projects/:projectId`                                                       | Dashboard | Renames a project. The slug (and its verification records) never changes.                                                           |
| POST   | `/dashboard/projects/:projectId/keys`                                                  | Dashboard | Creates another API key for the given project.                                                                                      |
| GET    | `/dashboard/projects/:projectId/keys`                                                  | Dashboard | Lists the given project's API keys.                                                                                                 |
| POST   | `/dashboard/projects/:projectId/keys/:keyId/revoke`                                    | Dashboard | Revokes an API key.                                                                                                                 |
| POST   | `/dashboard/projects/:projectId/keys/:keyId/rotate`                                    | Dashboard | Revokes an API key and issues its replacement.                                                                                      |
| POST   | `/dashboard/projects/:projectId/domains`                                               | Dashboard | Claims a domain for the given project and an explicit `mode`, issuing a challenge. Accepts an optional `external_id`.               |
| GET    | `/dashboard/projects/:projectId/domains`                                               | Dashboard | Cursor-paginated list of the project's domains, newest first. Filterable by `external_id` and/or `mode`.                            |
| GET    | `/dashboard/projects/:projectId/domains/:domainId`                                     | Dashboard | Gets a domain and its current verification record instructions.                                                                     |
| POST   | `/dashboard/projects/:projectId/domains/:domainId/verify`                              | Dashboard | Runs the DNS check for a claim and returns the updated domain plus the check's outcome.                                             |
| POST   | `/dashboard/projects/:projectId/domains/:domainId/regenerate`                          | Dashboard | Issues a fresh challenge for a `pending` or `failed` domain, restarting verification.                                               |
| DELETE | `/dashboard/projects/:projectId/domains/:domainId`                                     | Dashboard | Releases a domain claim.                                                                                                            |
| GET    | `/dashboard/projects/:projectId/domains/:domainId/events`                              | Dashboard | Cursor-paginated timeline of events published for a domain.                                                                         |
| GET    | `/dashboard/projects/:projectId/events`                                                | Dashboard | Cursor-paginated events across all of the project's domains, newest first. Filterable by `mode`.                                    |
| POST   | `/dashboard/projects/:projectId/webhooks`                                              | Dashboard | Creates a webhook endpoint for the given project; returns the signing secret once.                                                  |
| GET    | `/dashboard/projects/:projectId/webhooks`                                              | Dashboard | Lists the given project's webhook endpoints.                                                                                        |
| DELETE | `/dashboard/projects/:projectId/webhooks/:endpointId`                                  | Dashboard | Deletes a webhook endpoint.                                                                                                         |
| POST   | `/dashboard/projects/:projectId/webhooks/:endpointId/disable`                          | Dashboard | Stops deliveries to an endpoint without deleting it.                                                                                |
| POST   | `/dashboard/projects/:projectId/webhooks/:endpointId/enable`                           | Dashboard | Resumes deliveries to a disabled endpoint.                                                                                          |
| GET    | `/dashboard/projects/:projectId/webhooks/:endpointId/deliveries`                       | Dashboard | Cursor-paginated delivery log for an endpoint, newest first.                                                                        |
| POST   | `/dashboard/projects/:projectId/webhooks/:endpointId/deliveries/:deliveryId/redeliver` | Dashboard | Fires a fresh delivery of a past delivery's event.                                                                                  |
| POST   | `/v1/domains`                                                                          | Public    | Claims a domain for the key's project/mode and issues a challenge. Accepts an optional `external_id`.                               |
| GET    | `/v1/domains`                                                                          | Public    | Cursor-paginated list of domains claimed by the key's project/mode. Filterable by `external_id` and/or `domain`.                    |
| GET    | `/v1/domains/:id`                                                                      | Public    | Gets a claimed domain and its current verification record(s).                                                                       |
| DELETE | `/v1/domains/:id`                                                                      | Public    | Releases a domain claim.                                                                                                            |
| POST   | `/v1/domains/:id/verify`                                                               | Public    | Runs the DNS check for a claim and returns the updated domain plus the check's outcome.                                             |
| POST   | `/v1/domains/:id/regenerate`                                                           | Public    | Issues a fresh challenge for a `pending` or `failed` domain, restarting verification.                                               |
| GET    | `/v1/domains/:id/events`                                                               | Public    | Cursor-paginated timeline of events published for a domain (claimed, checks, transitions).                                          |
| POST   | `/v1/component-sessions`                                                               | Public    | Mints a short-lived, single-use session token for a drop-in component to claim one domain.                                          |
| GET    | `/frontend/verifications/:token`                                                       | Frontend  | Reads a claim's status, record instructions, detected DNS provider, and last check outcome by its `frontendToken`.                  |
| POST   | `/frontend/verifications/:token/check`                                                 | Frontend  | Runs the DNS check for a claim (rate limited) and returns the same shape as the `GET` above.                                        |
| GET    | `/frontend/verifications/:token/events`                                                | Frontend  | Cursor-paginated timeline of events published for a domain, with no account/project ids in the payload.                             |
| GET    | `/frontend/verifications/:token/cloudflare/authorize`                                  | Frontend  | Redirects to Cloudflare's OAuth consent screen to set up the claim's DNS record automatically (see below).                          |
| GET    | `/frontend/cloudflare/callback`                                                        | Frontend  | The Cloudflare OAuth callback; redirects back to the hosted verification page with an outcome (see below).                          |
| POST   | `/frontend/component-sessions/:sessionToken/claim`                                     | Frontend  | Spends a component session to claim a domain (rate limited); returns the claim plus its own `frontendToken`.                        |
| GET    | `/v1/openapi.json`                                                                     | none      | This api's OpenAPI 3.1 document, generated from the same route schemas — covers the Public and Frontend planes only (see below).    |
| ALL    | `/mcp`                                                                                 | MCP       | The hosted MCP endpoint (Streamable HTTP, JSON-RPC) — not part of the OpenAPI document above; see [`packages/mcp`](./packages/mcp). |

This table is maintained by hand — any PR that adds or changes an endpoint
must update it. The Public and Frontend planes are also documented by the
generated OpenAPI document at `GET /v1/openapi.json` (unauthenticated,
served on every host); the session-authenticated Dashboard plane
deliberately isn't part of that document, which is why this table remains
the one place covering all three. See [ARCHITECTURE.md](./ARCHITECTURE.md)
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

`POST /v1/domains` accepts an optional `external_id` — an opaque identifier
the claiming project attaches to correlate a domain with its own end user,
for the multi-tenant case where a builder brings a custom domain per
customer (e.g. a SaaS platform letting each of its customers connect
`shop.customer.com`). It's set only at claim time, returned on every domain
response (both planes) and on every event/webhook payload for that domain,
and carries no uniqueness constraint — the same `external_id` can own
several domains.

`GET /v1/domains` is cursor-paginated (`?limit=`/`?cursor=`, default 20,
max 100) and supports two combinable filters: `?external_id=` (every domain
claimed under that identifier) and `?domain=` (an exact match on the
claimed hostname — e.g. a middleware's "is acme.co verified for this
project?" check).

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

The dashboard's own `POST`/`GET /dashboard/projects/:projectId/domains`
share the same `modules/domains` use cases `/v1/domains` calls — claiming
accepts the same optional `external_id`, and the list accepts the same
`?external_id=` filter (no `?domain=` filter on this plane yet — that's a
dashboard UI addition for later), plus an optional `?mode=test|live` for
the dashboard's own test/live toggle, combinable with `?external_id=`.
The list spans both `test` and `live` claims for the project by default
(`mode` is a field on each row), newest first, cursor-paginated the same
way as `/v1/domains/:id/events` above (`?limit=`/`?cursor=`, default 20,
max 100). `:domainId` follows the same anti-enumeration 404 as `:projectId`
and `:keyId` elsewhere on this plane — a domain belonging to another
project reads as not found, not forbidden.

`GET /dashboard/projects/:projectId/events` accepts the same optional
`?mode=test|live` filter, narrowing the project-wide events table to one
mode; omitted, it returns both modes mixed, same as before this filter
existed.

### Frontend API

`verificationUrl` (returned by every plane that builds one — `/v1/domains`,
`/dashboard/.../domains`) embeds a domain claim's `frontendToken`: a
128-bit unguessable credential generated once at claim time, distinct from
the claim's own `id`. It authorizes exactly three things on exactly that
one claim, with nothing else to authenticate — no session, no api key:

```json
{
  "domain": "example.com",
  "mode": "live",
  "status": "pending",
  "projectName": "Acme",
  "records": [
    {
      "label": "_acme-challenge.example.com",
      "type": "TXT",
      "value": "acme-verify=..."
    }
  ],
  "check": {
    "outcome": "not_found",
    "checkedAt": "2026-07-19T12:00:00.000Z"
  },
  "updatedAt": "2026-07-19T12:00:00.000Z"
}
```

`GET /frontend/verifications/:token` returns the shape above; `check` is
`null` until the first check ever runs, and otherwise carries the same
`outcome`/`expected`/`detected` material as `/v1/domains/:id/verify`'s
`check` object (see above) minus the API-consumer-facing `explanation`
copy. `POST /frontend/verifications/:token/check` runs the exact same
verify path as `/v1/domains/:id/verify` (bus events fire the same way, the
domain's status transitions the same way) and returns the identical
shape — the only difference from the public API's verify endpoint is how
the claim is resolved (by token, not by api key + id) and that it's rate
limited: at most one check every 15 seconds and 20 per hour, per token,
`429 rate_limited` beyond that. `GET /frontend/verifications/:token/events`
is a cursor-paginated timeline the same shape as the other planes'
(`?limit=`/`?cursor=`, default 20, max 100), except each event omits
`domainId`/`projectId`/`domain` from its payload — this plane never
returns an account id, project id, or key material, only what the hosted
page renders.

An unknown token, a released domain's now-defunct token, and any other
lookup miss all 404 identically (`{ "error": { "code": "not_found" } }`)
— there is no second factor to fail differently once the token itself
doesn't resolve.

#### Component sessions

For a builder embedding a drop-in component (rather than calling `/v1`
directly), the flow is one backend touchpoint and then a component that
talks to the Frontend API on its own:

1. The builder's backend mints a session with its own api key:
   `POST /v1/component-sessions` with an optional `{ "externalId": "..." }`
   (the builder's own id for whoever's about to claim a domain — a user id,
   an account id, whatever makes sense in their own data model) returns
   `{ "sessionToken": "...", "expiresAt": "..." }`. The token is unguessable
   (the same entropy as an api key secret or a `frontendToken`) and expires
   in an hour if never spent.
2. The backend hands `sessionToken` to its frontend component — never the
   api key itself.
3. The component calls
   `POST /frontend/component-sessions/:sessionToken/claim` with
   `{ "domain": "example.com" }`. This claims the domain through the exact
   same path `/v1/domains` uses (same validation, same conflict/sandbox
   rules, same `domain.claimed` event), with the project/mode and
   `externalId` carried over from the session, and returns the same shape
   `GET /frontend/verifications/:token` does, plus the new claim's own
   `frontendToken`:

   ```json
   {
     "domain": "example.com",
     "mode": "live",
     "status": "pending",
     "projectName": "Acme",
     "records": ["..."],
     "check": null,
     "updatedAt": "2026-07-19T12:00:00.000Z",
     "frontendToken": "..."
   }
   ```

4. The component switches to the normal Frontend API endpoints
   (`/frontend/verifications/:frontendToken`, `/check`, `/events`) from
   there — the session has done its one job.

A session is single-use: spending it (successfully or not) consumes it, so
a second claim attempt on the same token — concurrent or sequential —
never succeeds. An unknown, expired, or already-consumed session all 404
identically (`{ "error": { "code": "not_found" } }`), the same
anti-enumeration stance as a `frontendToken` lookup miss. The claim itself
is rate limited per session token (10 attempts per hour) — generous for a
component retrying after a mistyped domain, not tuned for a bot.

### Cloudflare one-click DNS setup

`GET /frontend/verifications/:token`'s `provider` field (`'cloudflare'` or
`'unknown'`) is detected from the claim domain's nameservers — `'unknown'`
for every domain that isn't Cloudflare-hosted, including every `.test`
sandbox domain (which has no real DNS to inspect at all). The hosted page
uses it to gate an "Add this record for me" button next to the manual
instructions.

Clicking it starts a PKCE OAuth flow against a private Cloudflare OAuth
client (self-managed OAuth, authorizable only by the Cloudflare account
that created it — see setup below):

1. `GET /frontend/verifications/:token/cloudflare/authorize` redirects to
   Cloudflare's consent screen, with a PKCE `code_challenge` and a signed
   `state` binding the request to this one claim (the code verifier travels
   inside `state` itself — nothing is persisted server-side between this
   redirect and the callback).
2. The domain owner grants (or denies) Zone Read + DNS Edit access on
   Cloudflare.
3. Cloudflare redirects to `GET /frontend/cloudflare/callback`, which
   verifies `state`, exchanges the code for an access token, finds the zone
   matching the claim's domain, creates the exact TXT record the claim's
   manual instructions already show, publishes a `domain.dns_autoconfigured`
   event, and triggers the standard verify path — then redirects back to
   the hosted verification page (`?cloudflare=<outcome>`), where the
   existing status polling picks up the result.

`outcome` is one of `success`, `denied` (declined on Cloudflare's consent
screen), `no_matching_zone` (the authorizing account has no zone for the
domain), `record_create_failed`, `exchange_failed`, or `not_found` (the
claim was released mid-flow). A `state` that's missing, expired, or fails
signature verification has no safe redirect target and gets a plain
`400 invalid_request` instead of a redirect.

The Cloudflare access token is used once and discarded: it lives only in
the callback request's own local scope, is never persisted, and never
appears in a response, an event payload, or a log line. `domain.dns_autoconfigured`
fans out through the timeline and webhooks exactly like every other
`DomainEventMap` entry, always published ahead of the `domain.check_passed`/
`domain.verified` pair the triggered verify produces.

#### One-time Cloudflare setup

The private OAuth client itself is created once, by hand, in the Cloudflare
dashboard that owns the zones this flow should write to:

1. Log in to that Cloudflare account and go to **Manage Account → OAuth
   clients**.
2. Create a new client, left as **Private** (the default — authorizable
   only by this account; never switch it to Public, which starts an
   irreversible, ~2-day domain-ownership verification for a client URL this
   flow doesn't need).
3. Fill the form: **Client Name** `DomainProof`; **Response Type** `Code`;
   **Grant type** `Authorization Code`; **Token Authentication Method**
   `client_secret_post` (the exchange sends `client_secret` in the POST
   body — see `infra/cloudflare/oauth-client.ts`); **Client URL** is
   optional; skip every Advanced option.
4. Add BOTH **Redirect (Callback) URLs** — one client serves production and
   staging, same credentials on both services:
   `https://frontend.api.domainproof.dev/frontend/cloudflare/callback` and
   the staging api's Railway domain plus the same
   `/frontend/cloudflare/callback` path. These must match the runtime's
   redirect URI exactly, or Cloudflare rejects the exchange. Staging (and
   any preview environment) must also set `CLOUDFLARE_OAUTH_REDIRECT_URI`
   to its own registered URL — unset, every environment defaults to the
   production callback.
5. On the permissions screen, check exactly two boxes under **DNS &
   Zones**: **DNS → Edit** and **Zone → Read** (2/11 selected). Nothing
   else.
6. Cloudflare also offers a `cloudflare_oauth_client_publisher=...` DNS TXT
   record for "domain verification" at creation time — do **NOT** add it.
   That record is the first step of the public-client verification path
   (the irreversible one from step 2); the private client works fully
   without it.
7. Copy the generated **client ID** and **client secret** into
   `CLOUDFLARE_OAUTH_CLIENT_ID` / `CLOUDFLARE_OAUTH_CLIENT_SECRET` (see the
   env var table above) wherever the api runs.

### Webhooks

A project's webhook endpoints (`POST /dashboard/projects/:projectId/webhooks`)
subscribe to a non-empty subset of the project-scoped event types:
`domain.claimed`, `domain.challenge_regenerated`, `domain.check_passed`,
`domain.check_failed`, `domain.verified`, `domain.temporarily_failed`,
`domain.failed`, `domain.dns_autoconfigured` (every `DomainEventMap` entry
except `account.created`, which isn't scoped to a project). Creating an endpoint
returns its signing secret (`whsec_...`)
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
    "domain": "example.com",
    "externalId": "customer_123"
  }
}
```

`data` is the event's own payload (see `shared/events.ts`'s
`DomainEventMap`) — it always carries `mode`, so a single endpoint
subscribed across both test and live keys can tell which is which.
`externalId` is `null` when the claim didn't set one — a stable field to
correlate a delivery back to the claiming project's own end user without a
separate lookup.

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

## Operations

Checking a deploy, adding a custom domain, rotating a credential, or
triaging a production incident — see
[`.claude/skills/infra-ops/SKILL.md`](./.claude/skills/infra-ops/SKILL.md)
for the runbook, and [`.env.example`](./.env.example) at the repo root for
every credential/config name the infra needs.
