# DomainProof

Domain-ownership verification as an API-first product — prove control of a
domain via DNS TXT (primary) or an HTTP well-known file (secondary), with a
web dashboard, a public API, a typed SDK, a CLI, and an MCP server for
agent-driven verification.

## Monorepo map

```txt
apps/
  web/        # Next.js 15 (App Router) — the only Next app. Serves:
              #   - landing + project dashboard at the apex domain
              #     (domainproof.dev) — project routes live at the root
              #     (/<projectId>/...), Vercel/Resend-style, not under a
              #     /dashboard prefix
              #   - hosted verification portal at /verify/[token]
              #   - docs (Fumadocs) at /docs
              #   - a demo consumer app at /demo, deliberately distinct
              #     branding, consumes only the public SDK/API — never
              #     imports server internals
  api/        # Hono REST API on api.domainproof.dev
packages/
  core/       # Pure domain logic: state machine, verification checks, DNS
              # resolver interfaces. Consumed by apps/api. Exports shared
              # types (e.g. DomainStatus) that sdk/web may import.
  sdk/        # Typed public-API client. Node/server-side, including Next
              # server components and actions.
  cli/        # Command-line interface
  mcp/        # MCP server for agent integrations
```

pnpm workspaces + Turborepo, `catalog:` version pins in the root
`package.json`.

## Commands

```bash
pnpm install
pnpm turbo run lint typecheck test build   # full pipeline, same as CI
pnpm --filter <pkg> dev                    # e.g. pnpm --filter web dev
pnpm --filter <pkg> test                   # e.g. pnpm --filter core test
```

Run the full `lint typecheck test build` pipeline before opening a PR — it's
the same command CI runs.

## Conventions

- TypeScript strict mode everywhere. No `any` without a comment explaining
  why.
- Conventional commits (`feat:`, `fix:`, `chore:`, ...). No AI-generated
  footers, no `Co-authored-by` trailers, no bold markdown (`**`) in commit
  messages.
- Tests are colocated next to source as `*.test.ts`, run with vitest.
- Never reference internal planning or tracker identifiers (issue codes,
  internal doc IDs, sub-item labels, or similar) in PR titles/bodies, commit
  messages, code comments, or docs. Describe changes by what they do, not by
  an internal reference.

## Architecture rules that matter

These aren't style preferences — breaking them breaks the testability and
trust story the product is graded on.

- **All DNS and HTTP IO behind injected interfaces.** `DnsResolver` and
  `HttpFetcher` are interfaces defined in `packages/core` (zero IO). The
  concrete implementations that talk to real DNS/HTTP live in
  `apps/api/src/infra/dns/` and `apps/api/src/infra/http/` — core only
  knows the port, never a concrete adapter. Everything else — API routes,
  the state machine, tests — takes the interface as a dependency. This is
  what makes the failure/recovery UX demoable without waiting on real TTLs.
- **`.test` sandbox domains never hit real DNS.** Domains ending in `.test`
  are routed to an in-memory fixture resolver that simulates
  pending/verified/wrong-value/conflicting-record scenarios on demand. If
  you're adding a new failure mode, add it to the fixture resolver first,
  not to the real resolver.
- **State transitions only happen through the core state machine.** Don't
  set a domain's status directly from an API route or a UI action — call
  into `packages/core`'s state machine so every transition is validated and
  auditable in one place.
- **API errors always use the `{ error: { code, message } }` taxonomy.**
  Every non-2xx response from `apps/api` follows this shape (plus
  `docs_url` where useful). No ad-hoc error strings, no bare
  `{ message }`, no throwing raw error objects across the API boundary.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full layer map, dependency
rules, and a "where does X go?" decision table. The short version:

- `packages/core` is pure domain logic — zero IO, never imports from `apps/`.
- `apps/api/src/modules/*` is the plane-agnostic domain layer for its
  feature area — services, repositories, ports, pure domain logic. No
  routes, no HTTP. Depends on core and its own module, never on a
  concrete `infra/` adapter or the db client directly (only its own
  `repository.ts` does).
- `apps/api/src/apis/<plane>/` (`dashboard`, `v1`) is the HTTP surface —
  one folder per authentication plane. Route files parse/validate input,
  call injected services, and map results to HTTP — nothing else; a
  plane's `router.ts` applies that plane's global middleware once.
- `apps/api/src/infra/*` implements core/module ports (DB, DNS, HTTP,
  auth) and is only wired up from `apps/api/src/app.ts` (the composition
  root).

These are enforced by eslint (`no-restricted-imports`, see
`eslint.base.mjs`) and reviewed by the `architecture-reviewer` agent
(`.claude/agents/architecture-reviewer.md`) on every PR; PRs touching
`packages/ui` or `apps/web`'s UI are also reviewed by the
`frontend-reviewer` agent (`.claude/agents/frontend-reviewer.md`).

Standing rules for every PR, regardless of size:

- **Any PR that adds or changes API endpoints must update the endpoints
  table in `README.md`.** The v1 + Frontend planes are also documented by a
  generated OpenAPI 3.1 document (`GET /v1/openapi.json`, built from the
  same route schemas — see `apps/api/src/openapi.ts`), but the
  session-authenticated dashboard plane isn't part of that document, so the
  README table stays the one place covering all three planes.
- **PR titles follow conventional commits** (`feat:`, `fix:`, `refactor:`,
  ...), same as commit messages.
- **PR descriptions are written in the author's own voice, addressed to a
  reviewer** — no "you asked for X" / assistant-narration framing, no
  restating the prompt. Write it the way you'd write it if you'd typed
  every line yourself.

## Agent skills

See `.claude/skills/README.md` for what's available in this repo, and
`.claude/skills/verify-domain-flow/SKILL.md` for the end-to-end regression
loop (boot the app, drive the verification flow with Playwright, capture
screenshots).

`AGENTS.md` in this repo is a symlink to this file — either name works.
