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
    db/                           #   drizzle client + schema
    dns/                           #   node:dns resolver, .test sandbox resolver
    http/                           #   fetch-based HttpFetcher
  modules/                          # feature modules — domain rules, services, routes
    accounts/                         #   Clerk auth middleware, account bootstrap
    projects/                          #   brand slug policy (validation, reserved list, default)
    keys/                                #   API key encoding/parsing/service, api-key auth, rate limit, routes
```

`apps/web`, `packages/sdk`, `packages/cli`, `packages/mcp` are out of scope
for this map today — they're thin/stub packages that consume `@domainproof/core`
and the public API, not participants in the api's internal layering.

## Dependency rules

1. **`packages/core` imports nothing from `apps/` and performs no IO.** No
   `node:dns`, no `fetch`, no database client, no `apps/*` import of any
   kind. Core is a pure function library: given the same inputs (including
   injected port results), it always produces the same outputs.
2. **`modules/*` domain logic imports only core, `shared/`, and its own
   module** — never `infra/`, never a concrete infra adapter, never the db
   client directly. A service takes its dependencies (a `Database`, a
   `DnsResolver`, an `HttpFetcher`) as function arguments; it never reaches
   into `infra/` to construct one itself.
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
- **`modules/keys/routes.ts` imports `modules/projects`** (`getDefaultProjectId`)
  and the `ClerkAuthVariables` type from `modules/accounts`, rather than
  having project resolution injected from `app.ts`. The project lookup
  itself is not a route-file exception — it's a real service function in
  `modules/projects/service.ts`, called the same way `keys/routes.ts`
  calls its own module's `createKey`/`listKeys`/etc. The exception is
  narrower than it looks: one module's routes calling another module's
  service function directly, instead of every cross-module call being
  injected from `app.ts`. That's a known follow-up once a third module
  needs the same "resolve the caller's project" pattern.
- **Modules import the `Database` type and Drizzle table objects from
  `infra/db`.** Drizzle's query builder is table-object-driven
  (`db.select().from(accounts)...`), so services need the schema to build
  queries against the `db` client they're handed — that's different from a
  module reaching into `infra/` to *construct* a client or bypass an
  injected dependency. The db client is still always received as an
  argument; only `app.ts` ever calls `createDb(...)`.
- **Test files** import infra directly (e.g. `createDb` for integration
  tests, `createFixtureResolver`/`createFixtureFetcher` from
  `@domainproof/core/testing`). Tests aren't part of the runtime dependency
  graph the rules above protect.

## Where does X go?

| Task | Goes in |
|---|---|
| New DNS/HTTP record type logic (new record shape, new parsing rule) | `packages/core/src/record.ts` (+ `check-txt.ts`/`check-http.ts` if it changes what counts as a pass) |
| New verification state or transition | `packages/core/src/states.ts` |
| New public API endpoint | `apps/api/src/modules/<module>/routes.ts` (parsing/HTTP only) + a service function in the same module |
| New external service integration (email, webhooks delivery, a new DNS provider) | `apps/api/src/infra/<area>/`, wired into `app.ts` and injected into whichever module's service needs it |
| New tenant/account/project policy (quotas, plan limits, slug rules) | `apps/api/src/modules/projects/` (or a new module, if it doesn't fit an existing one) |
| New cross-module helper (error shape, pagination, result types) | `apps/api/src/shared/` |
| A test double for a core port | `packages/core/src/testing/` — export it from `testing/index.ts` so it's available via `@domainproof/core/testing` |

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

- **`no-restricted-imports`** (see `eslint.base.mjs` and each package's
  `eslint.config.mjs`) mechanically enforces: no `.js`-suffixed relative
  imports anywhere; `packages/core` cannot import from `apps/`;
  `apps/api/src/modules/**` (excluding tests) cannot import from
  `infra/dns/` or `infra/http/`.
- **Known enforcement gap:** the `infra/db` carve-out (schema tables + the
  `Database` type), the `modules/keys` → `modules/accounts` route-wiring
  import, and "route files may use hono" are documented exceptions above,
  not mechanically enforced — eslint's `no-restricted-imports` can't cheaply
  express "value imports only, types are fine" or "only this one specific
  cross-module import is allowed" without more plumbing than this repo's
  current lint setup carries. These are reviewed by hand and by the
  `architecture-reviewer` agent (`.claude/agents/architecture-reviewer.md`)
  instead.
- **The `architecture-reviewer` agent** reviews a diff against the four
  dependency rules above, extensionless imports, core purity, conventional
  commit PR titles, author-voice PR descriptions, and the README endpoints
  table being current.
