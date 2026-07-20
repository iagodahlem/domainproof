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
  shared/                     # cross-module helpers (e.g. the { error: { code, message } } shape)
  infra/                        # concrete adapters — implements core/module ports
    auth/                          #   Clerk JWKS client — implements accounts' SessionVerifier
    db/                           #   drizzle client + schema
    dns/                           #   node:dns resolver, .test sandbox resolver
    http/                           #   fetch-based HttpFetcher
  modules/                          # feature modules — see "Module anatomy" below
    accounts/                         #   ports.ts, middleware.ts, service.ts, repository.ts
    projects/                          #   service.ts, repository.ts, domain/brand.ts
    keys/                                #   routes.ts, service.ts, repository.ts, api-key.ts, rate-limit.ts, domain/{encoding,parse}.ts
```

### Module anatomy

Every module reads the same way. Its root holds a closed set of files —
present only if the module needs them, nothing else allowed at the root:

- **`routes.ts`** — HTTP mapping only (rule 3). Present only if the module
  exposes routes; `accounts` doesn't (it's consumed by other modules'
  routes via its middleware), so it has none.
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
- **`middleware.ts`** — a module's own Hono middleware, when it isn't
  route wiring for that module's own `routes.ts` (e.g.
  `accounts/middleware.ts` — accounts has no routes of its own, so its
  auth middleware isn't "route wiring", it's a standalone unit other
  modules mount). A module with more than one genuinely separate
  middleware concern may use purpose-named files instead of cramming them
  together — `keys/api-key.ts` (public-API auth) and `keys/rate-limit.ts`
  (rate limiting) are independent, independently-tested middleware, not
  variations on one theme, so they stay separate rather than forcing a
  single `middleware.ts` to do two jobs.

**`domain/`** holds pure logic with no db/IO — one file per concept, named
for the concept (`keys/domain/encoding.ts`, `keys/domain/parse.ts`,
`projects/domain/brand.ts`). A module with no pure logic has no `domain/`
folder — `accounts` doesn't need one today.

The reader rule: root = surface (HTTP, use cases, data access, contracts,
middleware); `domain/` = rules. Tests stay colocated next to the file they
test, including inside `domain/`.

This isn't mechanically enforced (see Enforcement) — the
`architecture-reviewer` agent checks a diff against it.

### Route planes

`apps/api` mounts two path prefixes, and every new route picks one:

- **`/v1/*`** — the public, API-key-authenticated plane (`dp_test_.../dp_live_...`).
  Reserved for the endpoints an integration calls — domain verification
  lands here next. Versioned because it's a contract external callers
  depend on.
- **`/dashboard/*`** — the session-authenticated backend of the dashboard
  app (e.g. `/dashboard/keys`). Unversioned — we control its only
  consumer, so there's no external contract to version.

Both planes are path-based on the same `api.domainproof.dev` origin today
— no host routing. If the dashboard plane ever moves to its own
subdomain, that's `dashboard.api.domainproof.dev` (grouped under the api
tree, not a sibling of it), and it's a separate PR — nothing here builds
host routing yet.

See README's API section for the current endpoints under each.

`apps/web`, `packages/sdk`, `packages/cli`, `packages/mcp` are out of scope
for this map today — they're thin/stub packages that consume `@domainproof/core`
and the public API, not participants in the api's internal layering.

## Dependency rules

1. **`packages/core` imports nothing from `apps/` and performs no IO.** No
   `node:dns`, no `fetch`, no database client, no `apps/*` import of any
   kind. Core is a pure function library: given the same inputs (including
   injected port results), it always produces the same outputs.
2. **`modules/*` domain logic imports only core, `shared/`, and its own
   module** — never `infra/`, never a concrete infra adapter. A service
   takes its dependencies (its module's repository, a `DnsResolver`, an
   `HttpFetcher`) as function arguments; it never reaches into `infra/` to
   construct one itself.

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
   access in a route handler — that's what the service layer is for.
4. **`infra/` implements core/module ports; it is imported only by the
   composition root (`app.ts` / `index.ts`) and by other infra.** Adapters
   never import from `modules/`.

### Where the rules bend, on purpose

Real code has a couple of unavoidable exceptions to rule 2/3, called out
explicitly rather than papered over:

- **Route files use Hono** (the `Hono`/`MiddlewareHandler` types, `c.json(...)`,
  etc.) — that's what "map results to HTTP" means in practice. The "modules
  don't import hono" framing in rule 2 is about domain/service code, not
  route files.
- **`modules/keys/routes.ts` imports two type-only cross-module
  references**: `ProjectsService` from `modules/projects/service` and
  `SessionAuthVariables` from `modules/accounts/middleware` — needed to
  type the injected `projectsService` parameter and the Hono middleware
  chain. Both are type-only; the actual `projectsService` and
  `sessionAuth` instances are constructed in `app.ts` and passed in, same
  as `keysService`. There's no cross-module *value* import left here —
  that's what the repository/service split closed off.
- **Test files** import infra directly where that's the point of the test:
  `repository.test.ts` and `routes.test.ts` use a real `Database` (via
  `createDb`) to verify persistence and end-to-end wiring; core's
  `createFixtureResolver`/`createFixtureFetcher` come from
  `@domainproof/core/testing`. Every other test — `service.test.ts`,
  `api-key.test.ts`, `middleware.test.ts` — uses a fake implementing the
  relevant repository/port interface instead, and is restricted from
  `@infra/db` the same as production code (see Enforcement).

## Where does X go?

| Task | Goes in |
|---|---|
| New DNS/HTTP record type logic (new record shape, new parsing rule) | `packages/core/src/record.ts` (+ `check-txt.ts`/`check-http.ts` if it changes what counts as a pass) |
| New verification state or transition | `packages/core/src/states.ts` |
| New public (API-key) endpoint | `apps/api/src/modules/<module>/routes.ts`, mounted under `/v1/*` in `app.ts` (parsing/HTTP only) + a use case in `service.ts` + any new data access in `repository.ts` |
| New dashboard (session) endpoint | Same as above, mounted under `/dashboard/*` instead |
| New db table/column a module needs | A new method on that module's `repository.ts`. Never a schema import in `service.ts` or `routes.ts`. |
| New vendor/external service integration (email, webhooks delivery, a new DNS provider, a new auth provider) | Define the port where the concept belongs (core's port files if domain-wide, the owning module's `ports.ts` if module-specific — see rule 2), implement the adapter in `apps/api/src/infra/<area>/`, wire it in `app.ts` and inject it into whichever module's service needs it |
| New pure logic with no db/IO (parsing, formatting, validation) | The module's `domain/<concept>.ts` — one file per concept |
| New tenant/account/project policy (quotas, plan limits, slug rules) | `apps/api/src/modules/projects/` (or a new module, if it doesn't fit an existing one) |
| New cross-module helper (error shape, pagination, result types) | `apps/api/src/shared/` |
| A test double for a core port | `packages/core/src/testing/` — export it from `testing/index.ts` so it's available via `@domainproof/core/testing` |
| A test double for a module's repository or port | A fake object implementing the interface, defined right in the test file that needs it (see `keys/service.test.ts`, `accounts/service.test.ts`) — no shared testing/ convention for `apps/api` yet, unlike core. |

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
- **Path aliases in `apps/api`.** `@infra/*`, `@modules/*`, and `@shared/*`
  map to `apps/api/src/{infra,modules,shared}/*` for imports that cross
  out of the current directory; an import that stays inside the same
  module or directory (e.g. `./service`, `./parse`) stays relative. `tsc`,
  `tsup`/esbuild, and `tsx` all read this straight from `tsconfig.json`'s
  `paths`; `vitest` needs `resolve.tsconfigPaths: true` set explicitly
  (`apps/api/vitest.config.ts`) to see the same mapping, since Vite doesn't
  read tsconfig `paths` on its own by default.

## Planned: events

Not built yet — this is the shape the next layer will take, so services
written today can anticipate it instead of needing a rewrite.

- **`shared/events.ts`** defines a typed event map (e.g.
  `{ "domain.verified": { domainId: string; projectId: string } }`) and an
  `EventBus` interface (`publish`, `subscribe`) that modules code against.
- **`infra/events/`** holds the concrete implementation — an in-process
  `EventBus` to start (a `Map` of subscribers, synchronous or microtask
  dispatch). Swapping to a queue (SQS, a Postgres-backed outbox, etc.) later
  means writing a new adapter here, not touching any module.
- **Services publish after the state transition that produced the event
  commits** — never before, and never as a side effect buried inside the
  state machine itself (`packages/core`'s `transition()` stays pure and
  event-free). A service calls `core`'s `transition`, persists the result,
  and only then calls `eventBus.publish(...)`.
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

## Enforcement

- **`no-restricted-imports`** (see `eslint.base.mjs` and
  `apps/api/eslint.config.mjs`) mechanically enforces, repo-wide: no
  `.js`-suffixed relative imports; `packages/core` cannot import from
  `apps/`. Within `apps/api/src/modules/`, three non-overlapping file
  groups each get their own rule (flat config overrides
  `no-restricted-imports` per matching block rather than merging
  patterns, so each group's full pattern list is spelled out where it's
  defined):
  - Every non-test file except `repository.ts` cannot import
    `infra/dns/`, `infra/http/`, `infra/auth/`, or `@infra/db` —
    relative or via the `@infra/dns`, `@infra/http`, `@infra/auth`,
    `@infra/db` path aliases.
  - `repository.ts` may import `@infra/db`, but still not
    `infra/dns/http/auth`.
  - Every test except `repository.test.ts` and `routes.test.ts` cannot
    import `@infra/db` either — they use a fake instead.
- **Known enforcement gap:** "route files may use hono" and the module
  anatomy itself (closed root file set, `domain/` for pure logic, no
  `service.ts` calling another module's `repository.ts`) are documented
  above, not mechanically enforced — eslint's `no-restricted-imports`
  can't cheaply express "only these exact filenames belong at this
  directory level" without more plumbing than this repo's current lint
  setup carries. These are reviewed by hand and by the
  `architecture-reviewer` agent (`.claude/agents/architecture-reviewer.md`)
  instead.
- **The `architecture-reviewer` agent** reviews a diff against the four
  dependency rules above, the module anatomy (closed root file set,
  `domain/` placement, repository-only db access), extensionless imports,
  core purity, conventional commit PR titles, author-voice PR
  descriptions, and the README endpoints table being current.
