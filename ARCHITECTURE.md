# Architecture

This is the layer map for the repo: what each layer is allowed to depend on,
where new code goes, and how those rules are enforced. It's a working
reference, not a design essay — if you're adding code and aren't sure where
it belongs, check the decision table below before the prose.

## Layer map

```txt
packages/
  core/                  # pure domain logic, zero IO
    states.ts            #   domain verification state machine
    domain.ts             #   hostname normalization / registrable domain
    token.ts               #   token generation + constant-time comparison
    record.ts               #   TXT/well-known record host, value, parsing (brand-scoped)
    check-txt.ts              #   TXT check: DnsResolver result -> outcome
    check-http.ts               #   well-known-file check: HttpFetcher result -> outcome
    resolver.ts                  #   DnsResolver port (interface)
    fetcher.ts                    #   HttpFetcher port (interface)
    testing/                       #   fixture DnsResolver/HttpFetcher — @domainproof/core/testing

apps/api/src/
  index.ts               # process entry (starts the server)
  app.ts                  # composition root: createApp(deps) — ALL wiring happens here
  env.ts                    # environment schema/parsing
  apis/                       # HTTP surface, one folder per plane — see "API planes" below
    dashboard/                   # session-authenticated backend of the dashboard app
      router.ts                    #   plane root: applies session auth once, mounts route files
      middlewares/session-auth.ts  #   dashboard-only middleware
      routes/keys.ts                #   thin HTTP mapping, calls injected services
    v1/                          # public, API-key-authenticated product API
      router.ts                    #   plane root: applies api-key auth + rate limit once
      middlewares/api-key.ts       #   v1-only middleware (public API key auth)
  shared/                     # cross-module, cross-plane helpers
    http-errors.ts                #   the { error: { code, message } } shape
    middlewares/rate-limit.ts     #   plane-agnostic — any apis/<plane> can mount it
  infra/                        # concrete adapters — implements core/module ports
    auth/                          #   Clerk JWKS client — implements accounts' SessionVerifier
    db/                           #   drizzle client + schema
    dns/                           #   node:dns resolver, .test sandbox resolver
    http/                           #   fetch-based HttpFetcher
  modules/                          # plane-agnostic domain layer — see "Module anatomy" below
    accounts/                         #   ports.ts, service.ts, repository.ts
    projects/                          #   service.ts, repository.ts, domain/brand.ts
    keys/                                #   service.ts, repository.ts, domain/{encoding,parse}.ts
  workers/                          # non-HTTP drivers of modules/ — see "Background workers" below
    recheck-scheduler.ts              #   setInterval loop driving modules/domains' recheck use cases
```

### API planes

`apps/api` mounts three path prefixes as separate folders under `apis/`,
and every new route picks one:

- **`apis/v1/`** (`/v1/*`) — the public, API-key-authenticated plane
  (`dp_test_.../dp_live_...`). Reserved for the endpoints an integration
  calls — domain claiming/verification lives here. Versioned because it's
  a contract external callers depend on.
- **`apis/dashboard/`** (`/dashboard/*`) — the session-authenticated
  backend of the dashboard app (e.g. `/dashboard/keys`). Unversioned — we
  control its only consumer, so there's no external contract to version.
- **`apis/frontend/`** (`/frontend/*`) — named after Clerk's FAPI: it
  serves the builder's _customers_ and DomainProof's own frontends (the
  hosted verification page, drop-in components later), not the builder
  themselves. Authenticated by neither a session nor an api key — each
  route resolves an unguessable per-claim `frontendToken` embedded in its
  own `:token` path param instead (see `infra/db/schema.ts`'s doc
  comment), so there's no plane-wide auth middleware to apply (contrast
  with the other two planes' `router.ts`, below). Unversioned, same
  reasoning as the dashboard plane: we control who calls it (our own
  hosted page and future first-party components), not an external
  integrator's contract.

All three planes are path-based on one origin, and that origin is also
host-restricted in production:

| Host                                                                          | Serves              |
| ----------------------------------------------------------------------------- | ------------------- |
| `api.domainproof.dev`                                                         | `/v1/*` only        |
| `dashboard.api.domainproof.dev`                                               | `/dashboard/*` only |
| `verify.domainproof.dev`                                                      | `/frontend/*` only  |
| anything else (local dev, tests, Railway's `*.up.railway.app` service domain) | every plane         |

This is enforced by `shared/middlewares/host-restriction.ts`, applied once
at the root of `app.ts` — ahead of every plane router, since it decides
which plane (if any) a request may reach before any plane's own auth
middleware runs. It's driven by three optional env vars, `PUBLIC_API_HOST`,
`DASHBOARD_API_HOST`, and `FRONTEND_API_HOST` (see `env.ts`); unset (the
default everywhere except production) means no restriction at all, so
local dev and tests never need `/etc/hosts` tricks to exercise any plane.
The wrong plane on a restricted host gets a 404 through the shared error
taxonomy, not a 403 — a 403 would confirm the other plane's routes exist
on that host, which is exactly the information a 404 withholds. `/health`
is the one exception: it answers on every host, restricted or not, since
external uptime monitors hit it directly on the production hostnames
rather than through Railway's internal healthcheck.

**A new plane hostname is created only when a real auth/CORS boundary
appears, never speculatively.** `dashboard.api.domainproof.dev` earned one
because the dashboard plane needed to be unreachable from hosts serving
the public API — a real boundary — and `verify.domainproof.dev` earned one
for the same reason: the Frontend API is reachable with no session and no
api key at all, so it needs to be unreachable from the hosts that serve
the other two authenticated planes, not because splitting hosts looked
tidy. The path-based split (`/v1/*` vs `/dashboard/*` vs `/frontend/*`)
remains the source of truth for which plane a route belongs to; host
restriction is an additional production-only constraint layered on top,
not a replacement for it.

**A plane's `router.ts` is the only place its global middleware gets
applied.** `apis/dashboard/router.ts` mounts session auth once for the
whole plane; `apis/v1/router.ts` mounts api-key auth + rate limiting once.
`apis/frontend/router.ts` has no plane-wide middleware to mount — its
"auth" is a per-route `:token` path param, and its one rate-limited route
mounts that limiter itself (see "Middleware placement" below), so there's
nothing broader to apply once, for the whole plane, ahead of every route.
Route files never take auth middleware as a parameter or wire it
themselves — by the time a route handler runs, whatever plane-wide
middleware applies has already run and set whatever context it sets.

**Why HTTP lives outside modules/:** a module can serve more than one
plane. `keys` already does — the dashboard plane's `routes/keys.ts` lists
and manages keys for a signed-in builder, while `v1`'s `middlewares/api-key.ts`
authenticates public API calls against that same data. `domains` does too,
now three ways: `v1` gets the domain-claiming/verification endpoints,
`dashboard` gets a read/write view scoped to a signed-in builder's own
projects, `frontend` gets a read + bounded-recheck view scoped to
whichever one claim a `frontendToken` resolves to — one `modules/domains/`
(service + repository), three thin route files, each in its own plane.

**Middleware placement**, in order of preference:

- Plane-specific (only one plane will ever use it) → `apis/<plane>/middlewares/`.
- Plane-agnostic (any plane could mount it) → `shared/middlewares/`. It
  must not assume a specific plane's context-variable shape — `rate-limit.ts`
  only requires `{ keyId: string }`, not `v1`'s full `ApiKeyAuthVariables`.
  `host-restriction.ts` is the extreme version of this: it runs ahead of
  either plane's auth and requires no context at all — it decides which
  plane a request may reach before there's any plane-specific state to
  assume.
- Module-owned, and genuinely domain-related (not auth/rate-limiting) —
  e.g. a feature-flag check tied to one module's business rules → the
  module's own `middlewares/<name>.ts`. One file per middleware, same as
  everywhere else.

`packages/sdk`, `packages/cli`, `packages/mcp` are out of scope for this map
today — they're thin/stub packages that consume `@domainproof/core` and the
public API, not participants in the api's internal layering. `apps/web` has
its own peer layer map instead: see [`apps/web/ARCHITECTURE.md`](./apps/web/ARCHITECTURE.md).

### Background workers

`workers/` holds non-HTTP drivers of `modules/` — code that calls a
module's use cases on a timer instead of in response to a request.
`workers/recheck-scheduler.ts` is the first one: a `setInterval` loop that
calls `modules/domains`' `recheckDueDomains`/`expireOverdueGraceWindows`
each tick, started from `index.ts` alongside the HTTP server.

A worker is a **third kind of module consumer**, alongside `apis/dashboard`
and `apis/v1` — it depends on a module's service type directly (e.g.
`import type { DomainsService } from '@modules/domains/service'`), the
same way a route file does, and for the same reason: it's actively calling
into the module, not implementing a port a module depends on. That's what
puts it in `workers/` rather than `infra/` — `infra/` is for adapters a
module (or `app.ts`) calls _through_ a port it owns (`DnsResolver`,
`HttpFetcher`, `SessionVerifier`, `EventBus`); a worker is closer in shape
to a plane's route file than to any of those, it's just triggered by a
clock instead of an HTTP request. Unlike a route file, it isn't part of
either authentication plane, so it doesn't belong under `apis/` either —
hence its own top-level folder.

`app.ts` doesn't build or start a worker itself — `index.ts` calls
`createServices` (see `AppServices`) once to get `domainsService`, then
passes that same result into both `createApp` (for HTTP routing) and
`createRecheckScheduler(...)`, so the HTTP app and the worker share the
exact same `domainsService` instance rather than `index.ts` duplicating
`app.ts`'s composition-root wiring to build a second one. A worker file
still never constructs its own repository or infra adapter — it only ever
receives an already-wired module service as a constructor argument, same
as any other consumer.

### Module anatomy

Modules are the **plane-agnostic domain layer** — services, repositories,
ports, and pure domain logic. No `routes.ts`, no middleware tied to a
specific plane, no HTTP at all. A module's root holds a closed set of
files, present only if the module needs them, nothing else allowed there:

- **`service.ts`** — use cases, with the module's repository (and any
  ports/other modules' services) injected. This is where orchestration
  logic lives — e.g. `accounts/service.ts`'s `ensureAccount` is "try
  create, fall back to a re-read on conflict," not just a passthrough.
- **`repository.ts`** — all db access for the module (see the repository
  rule below). Present only if the module persists anything.
- **`ports.ts`** — module-owned port interfaces the module depends on but
  doesn't implement (e.g. `accounts/ports.ts`'s `SessionVerifier`,
  implemented by `infra/auth/clerk.ts`). Present only if the module owns a
  port.
- **`middlewares/<name>.ts`** — only when a middleware is genuinely
  domain-related rather than plane infrastructure (see "Middleware
  placement" above). None of today's modules have one; auth and rate
  limiting both turned out to be plane/shared concerns, not module ones.

**`domain/`** holds pure logic with no db/IO — one file per concept, named
for the concept (`keys/domain/encoding.ts`, `keys/domain/parse.ts`,
`projects/domain/brand.ts`). A module with no pure logic has no `domain/`
folder — `accounts` doesn't need one today.

The reader rule: root = use cases, data access, contracts (service,
repository, ports); `domain/` = rules; HTTP and plane middleware live
outside the module entirely, in `apis/`. Tests stay colocated next to the
file they test, including inside `domain/`.

This isn't mechanically enforced (see Enforcement) — the
`architecture-reviewer` agent checks a diff against it.

## Dependency rules

1. **`packages/core` imports nothing from `apps/` and performs no IO.** No
   `node:dns`, no `fetch`, no database client, no `apps/*` import of any
   kind. Core is a pure function library: given the same inputs (including
   injected port results), it always produces the same outputs.
2. **`modules/*` domain logic imports only core, `shared/`, and its own
   module** — never `infra/`, never a concrete infra adapter, and never
   `apis/`. A service takes its dependencies (its module's repository, a
   `DnsResolver`, an `HttpFetcher`) as function arguments; it never
   reaches into `infra/` to construct one itself, and it never imports
   HTTP/plane concerns from `apis/` — that dependency runs the other way
   (a plane's route file imports and calls a module's service).

   This includes vendors: **any external API or service — Clerk today,
   Resend and DNS-provider APIs next — is an infra adapter sitting behind
   a port.** A module never imports a vendor SDK or calls a vendor's
   endpoint directly. A port doesn't have to be core-owned like
   `DnsResolver`/`HttpFetcher` — when the concept is specific to one
   module rather than domain-wide, the module that owns the concept owns
   the port, in its `ports.ts`. `SessionVerifier` (`modules/accounts/ports.ts`,
   implemented by `infra/auth/clerk.ts`) is the example: "verify a login
   session" is accounts-module business, not something `packages/core`
   needs to know about, so the port lives with the module instead of core.

   This also includes the db: **only a module's `repository.ts` imports
   `@infra/db`** (the `Database` type and Drizzle schema tables). Services
   take their repository as an injected dependency and call its methods;
   they never see a `Database` or a schema table. This isn't a documented
   exception, it's the rule — see "Module anatomy" above.

3. **Route files only parse/validate input, call services, and map results
   to HTTP.** No query building, no business rules, no direct db/infra
   access in a route handler, and no wiring plane-global middleware
   themselves — that's the plane's `router.ts`.
4. **`infra/` implements core/module ports; it is imported only by the
   composition root (`app.ts` / `index.ts`) and by other infra.** Adapters
   never import from `modules/` or `apis/`.
5. **No `apis/<plane>` imports from another `apis/<plane>`.** Two planes
   sharing logic means the logic belongs in `modules/`, not in a
   cross-plane import — this holds for every pair (`dashboard`/`v1`,
   `dashboard`/`frontend`, `v1`/`frontend`). A plane may freely import from
   `modules/`, `shared/`, and its own subtree.

### Where the rules bend, on purpose

Real code has a couple of unavoidable exceptions to rule 2/3, called out
explicitly rather than papered over:

- **Route files use Hono** (the `Hono`/`MiddlewareHandler` types, `c.json(...)`,
  etc.) — that's what "map results to HTTP" means in practice. The "modules
  don't import hono" framing in rule 2 is about domain/service code, not
  route files (which now live in `apis/`, not `modules/`, anyway).
- **`apis/v1/middlewares/api-key.ts` depends on `modules/keys`'
  `KeysRepository`** directly, not through a service. It's a single
  lookup-plus-touch (`findByKeyId`, `touchLastUsed`) with no orchestration
  above what the repository already provides, so adding a passthrough
  service would be ceremony without payoff. If public-API-key auth ever
  needs a real use case (rotation-on-suspicious-use, say), that logic
  belongs in `keys/service.ts`, and the middleware would call that
  instead.
- **Test files** import infra directly where that's the point of the test:
  `repository.test.ts` files and `apis/dashboard/routes/keys.test.ts` use
  a real `Database` (via `createDb`) to verify persistence and end-to-end
  wiring; core's `createFixtureResolver`/`createFixtureFetcher` come from
  `@domainproof/core/testing`. Every other test — `service.test.ts`,
  `api-key.test.ts`, `session-auth.test.ts` — uses a fake implementing the
  relevant repository/port interface instead, and modules' tests are
  restricted from `@infra/db` the same as production code (see
  Enforcement). `Logger` is required everywhere it's injected (no
  `noopLogger` default survives past the composition root) — tests use
  `createFakeLogger` from `apps/api/src/shared/testing/fake-logger.ts`,
  the one shared fake this repo keeps outside a module's own test file,
  since `Logger` is a `shared/`-owned port every module and plane
  constructs against, not a module-specific one.

## Where does X go?

| Task                                                                                                        | Goes in                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New DNS/HTTP record type logic (new record shape, new parsing rule)                                         | `packages/core/src/record.ts` (+ `check-txt.ts`/`check-http.ts` if it changes what counts as a pass)                                                                                                                                                                                              |
| New verification state or transition                                                                        | `packages/core/src/states.ts`                                                                                                                                                                                                                                                                     |
| New public (API-key) endpoint                                                                               | `apps/api/src/apis/v1/routes/<name>.ts` (parsing/HTTP only, mounted in `apis/v1/router.ts`) + a use case in the relevant module's `service.ts` + any new data access in its `repository.ts`                                                                                                       |
| New dashboard (session) endpoint                                                                            | Same shape, under `apps/api/src/apis/dashboard/routes/` and `apis/dashboard/router.ts` instead                                                                                                                                                                                                    |
| New Frontend API (per-claim token) endpoint                                                                 | Same shape, under `apps/api/src/apis/frontend/routes/` and `apis/frontend/router.ts` instead — resolve the caller's claim via the module's `*ByFrontendToken` use case, never a `projectId`/`mode`/session                                                                                        |
| New db table/column a module needs                                                                          | A new method on that module's `repository.ts`. Never a schema import in `service.ts` or a route file.                                                                                                                                                                                             |
| New vendor/external service integration (email, webhooks delivery, a new DNS provider, a new auth provider) | Define the port where the concept belongs (core's port files if domain-wide, the owning module's `ports.ts` if module-specific — see rule 2), implement the adapter in `apps/api/src/infra/<area>/`, wire it in `app.ts` and inject it into whichever module's service (or plane router) needs it |
| New pure logic with no db/IO (parsing, formatting, validation)                                              | The module's `domain/<concept>.ts` — one file per concept                                                                                                                                                                                                                                         |
| New plane-specific middleware (only one plane will ever use it)                                             | `apis/<plane>/middlewares/<name>.ts`                                                                                                                                                                                                                                                              |
| New plane-agnostic middleware (any plane could use it)                                                      | `shared/middlewares/<name>.ts` — don't assume a specific plane's context-variable shape                                                                                                                                                                                                           |
| New tenant/account/project policy (quotas, plan limits, slug rules)                                         | `apps/api/src/modules/projects/` (or a new module, if it doesn't fit an existing one)                                                                                                                                                                                                             |
| New cross-module, cross-plane helper (error shape, pagination, result types)                                | `apps/api/src/shared/`                                                                                                                                                                                                                                                                            |
| New background/scheduled worker (a timer-driven consumer of a module, not an HTTP route)                    | `apps/api/src/workers/<name>.ts` — depends on the module's service type directly, same as a route file; started from `index.ts` using the `domainsService`-shaped instance `createApp` returns alongside `app`, never a second copy built by hand                                                 |
| A test double for a core port                                                                               | `packages/core/src/testing/` — export it from `testing/index.ts` so it's available via `@domainproof/core/testing`                                                                                                                                                                                |
| A test double for a module's repository or port                                                             | A fake object implementing the interface, defined right in the test file that needs it (see `keys/service.test.ts`, `accounts/service.test.ts`) — module-specific fakes have no shared testing/ home.                                                                                             |
| A test double for a shared/ port used across modules and planes (e.g. `Logger`)                             | `apps/api/src/shared/testing/` — export it from `testing/index.ts`, same shape as core's convention (see `createFakeLogger` in `shared/testing/fake-logger.ts`)                                                                                                                                   |

## Tooling

- **Extensionless imports.** Every package builds (or typechecks) under
  `moduleResolution: "bundler"`. Relative imports never carry a `.js`
  suffix — that was only ever needed for `tsc`'s NodeNext resolution,
  which nothing in this repo uses anymore.
- **Internal packages export source, not a build.** `packages/core` has no
  build step — its `package.json` `exports` point straight at
  `./src/index.ts` (and `./src/testing/index.ts` for the
  `@domainproof/core/testing` subpath). With `moduleResolution: "bundler"`,
  editors, `tsc`, `vitest`, and `tsx` all resolve types and runtime
  directly from source: no build ordering to get right, no stale dist to
  go stale, go-to-definition lands in the real file. This is deliberate —
  a package that's never published and only consumed inside this
  workspace doesn't need a compiled artifact of its own.
- **Deployable artifacts bundle their workspace dependencies.** `apps/api`
  builds with [tsup](https://tsup.egoist.dev/) (esbuild) and sets
  `noExternal: [/^@domainproof\//]`, so `@domainproof/core`'s source gets
  bundled straight into `apps/api/dist/index.js` — the built output has no
  runtime import of the package, which is what makes the Docker image
  self-contained regardless of core having no dist of its own. The
  `packages/sdk|cli|mcp` stubs keep their own tsup builds (they're future
  publishable/executable artifacts), but none of them depend on a
  workspace package yet; the day one does, its build needs the same
  `noExternal` treatment. `apps/web` doesn't import `@domainproof/core`
  yet either — when it does, add `transpilePackages: ["@domainproof/core"]`
  to `next.config.ts`, since Next's own bundler needs the same "resolve
  this workspace package from source" opt-in tsup gets from `noExternal`.
- **Path aliases in `apps/api`.** `@apis/*`, `@infra/*`, `@modules/*`, and
  `@shared/*` map to `apps/api/src/{apis,infra,modules,shared}/*` for
  imports that cross out of the current directory; an import that stays
  inside the same file's own directory (e.g. `./service`, `./parse`)
  stays relative. `tsc`, `tsup`/esbuild, and `tsx` all read this straight
  from `tsconfig.json`'s `paths`; `vitest` needs `resolve.tsconfigPaths: true`
  set explicitly (`apps/api/vitest.config.ts`) to see the same mapping,
  since Vite doesn't read tsconfig `paths` on its own by default. `paths`
  entries are written in explicit relative form (`"./src/infra/*"`, not
  `"src/infra/*"`) so `baseUrl` can stay unset (it's deprecated) —
  `tsc` accepts `paths` without `baseUrl` since 4.1, but only when the
  path values themselves are relative; `drizzle-kit`'s own config loader
  is stricter about this than `tsc` is, and was the thing that actually
  surfaced it.
- **Editor-vs-repo TypeScript version drift.** This repo pins a specific
  `typescript` version, but an editor's language server may run a newer
  one with stricter defaults. Every buildable package under `apps/`/`packages/`
  (except `apps/web`, which gets its ambient types from Next's own
  tooling) sets `"types": ["node"]` explicitly in its `tsconfig.json` —
  newer `tsc` versions have been seen to stop auto-including `@types/node`'s
  ambient globals (`process`, `console`, `Buffer`, the `NodeJS` namespace,
  `import.meta.url`'s typing) without it, even though `@types/node` is a
  real, present devDependency. Verified against `typescript@beta` in
  addition to the repo's pinned version — see Enforcement.

## Events

- **`shared/events.ts`** defines the typed event map (`DomainEventMap`, one
  entry per namespaced event type — `account.created`, `domain.claimed`,
  `domain.check_passed`, `domain.check_failed`, `domain.verified`,
  `domain.temporarily_failed`, `domain.failed`) and the `EventBus` interface
  (`publish`, `subscribe`) that modules code against.
- **`infra/events/in-process-bus.ts`** holds the concrete implementation — an
  in-process `EventBus` (a `Map` of subscribers, dispatched in registration
  order and awaited from `publish`). Swapping to a queue (SQS, a
  Postgres-backed outbox, etc.) later means writing a new adapter here, not
  touching any module — every publisher/subscriber only ever depends on the
  `EventBus` interface from `shared/`.
- **Services publish after the state transition that produced the event
  commits** — never before, and never as a side effect buried inside the
  state machine itself (`packages/core`'s `transition()` stays pure and
  event-free). A service calls `core`'s `transition`, persists the result,
  and only then calls `eventBus.publish(...)` (see `modules/domains/service.ts`,
  `modules/accounts/service.ts`).
- **`modules/events/`** is the timeline: its `repository.ts` persists every
  published event to the generic `events` table, and its `service.ts`
  registers a persistence subscriber first for every event type in `app.ts`
  — before any other subscriber (e.g. email) — so the timeline is a
  guaranteed, complete record regardless of what else reacts to an event.
  `GET /v1/domains/:id/events` (cursor-paginated) reads it back.
- **`modules/notifications/`** is the Resend email subscriber for
  `account.created`/`domain.verified`/`domain.temporarily_failed`/
  `domain.failed` — see "JSX in modules", below, for its file layout.
- **Subscribers are plain module functions**, registered against the bus in
  `app.ts` (the composition root) — the same place every other adapter gets
  wired up. A module never subscribes to its own or another module's events
  from inside `modules/`; that registration is composition-root wiring, not
  domain logic.
- **The queue-swap path is "replace the infra adapter."** Every module
  keeps depending on the same `EventBus` interface from `shared/`;
  swapping in-process dispatch for a real queue is a change to
  `infra/events/` and `app.ts`'s wiring, with zero changes to any module's
  domain code.

### JSX in modules

`modules/notifications/` is the first module that renders anything, so its
files extend (not replace) the module anatomy rules above:

- **`service.tsx`**, not `service.ts` — the module's root file set is the
  same closed set (service/repository/ports/middlewares), just with a
  `.tsx` extension where a file's use cases construct JSX directly (here,
  the event subscribers render a template as part of building the email).
  `tsconfig.json`'s `jsx: "react-jsx"` and eslint's `files` globs cover
  `.tsx` alongside `.ts` repo-wide for exactly this reason.
- **`domain/templates/`** — a subfolder of `domain/`, not a flat file per
  concept like `keys/domain/encoding.ts`. Rendering concerns (a shared
  `layout.tsx` plus one file per email) are still pure, IO-free logic —
  `domain/`'s actual rule — they just naturally group as a folder once
  there's more than a couple of them. `domain/render.ts` (the
  `@react-email/render` wrapper) stays a flat file alongside it.

## Enforcement

- **`no-restricted-imports`** (see `eslint.base.mjs` and
  `apps/api/eslint.config.mjs`) mechanically enforces, repo-wide: no
  `.js`-suffixed relative imports; `packages/core` cannot import from
  `apps/`. Within `apps/api/src/`, several non-overlapping file groups
  each get their own rule (flat config overrides `no-restricted-imports`
  per matching block rather than merging patterns, so each group's full
  pattern list is spelled out where it's defined):
  - `modules/**` (non-test, non-`repository.ts`) cannot import
    `infra/dns/`, `infra/http/`, `infra/auth/`, `@infra/db`, or `apis/` —
    relative or via the `@infra/*`/`@apis/*` path aliases.
  - `modules/**/repository.ts` may import `@infra/db`, but still not
    `infra/dns/http/auth` or `apis/`.
  - `modules/**/*.test.ts` (except `repository.test.ts`) cannot import
    `@infra/db` or `apis/` either — they use a fake instead.
  - Every pair of `apis/dashboard/**`, `apis/v1/**`, and `apis/frontend/**`
    is barred from importing the other two — relative or via the
    `@apis/dashboard`/`@apis/v1`/`@apis/frontend` path aliases.
- **`typescript@beta` verification.** `apps/api`'s `tsc --noEmit` is also
  run against `typescript@beta` (via `pnpm --package=typescript@beta dlx tsc`)
  as part of pre-merge verification, to catch editor-visible errors the
  repo's pinned version doesn't surface — see "Editor-vs-repo TypeScript
  version drift" under Tooling. Not wired into CI as a blocking gate yet
  (a beta compiler can fail on unrelated new checks); run by hand when
  touching `tsconfig.json` files or anything import.meta/global-typing
  adjacent.
- **Known enforcement gap:** "route files may use hono", the
  `apis/v1/middlewares/api-key.ts` -> `modules/keys` repository exception,
  and the module/plane anatomy itself (closed root file sets, `domain/`
  for pure logic) are documented above, not mechanically enforced —
  eslint's `no-restricted-imports` can't cheaply express "only these exact
  filenames belong at this directory level" or "this one specific
  cross-boundary import is allowed" without more plumbing than this
  repo's current lint setup carries. These are reviewed by hand and by
  the `architecture-reviewer` agent (`.claude/agents/architecture-reviewer.md`)
  instead.
- **The `architecture-reviewer` agent** reviews a diff against the five
  dependency rules above, the module/plane anatomy (closed root file
  sets, `domain/` placement, repository-only db access, plane-global
  middleware only in `router.ts`), extensionless imports, core purity,
  conventional commit PR titles, author-voice PR descriptions, and the
  README endpoints table being current.
