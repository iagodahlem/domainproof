# DomainProof

Domain-ownership verification as an API-first product — prove control of a
domain via DNS TXT (primary) or an HTTP well-known file (secondary), with a
web dashboard, a public API, a typed SDK, a CLI, and an MCP server for
agent-driven verification.

## Monorepo map

```txt
apps/
  web/        # Next.js 15 (App Router) — the only Next app. Serves:
              #   - landing + dashboard at the apex domain (domainproof.dev)
              #   - hosted verification portal at /v/[token]
              #   - docs (Fumadocs) on docs.domainproof.dev via host-based routing
              #   - a demo consumer app on demo.domainproof.dev via host-based
              #     routing, deliberately distinct branding, consumes only the
              #     public SDK/API — never imports server internals
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

- **All DNS and HTTP IO behind injected interfaces.** `DnsResolver` (and any
  HTTP-fetch equivalent for the well-known-file check) is an interface
  defined in `packages/core`. The only concrete implementation that talks to
  real DNS/HTTP lives in `packages/core/src/resolvers/`. Everything else —
  API routes, the state machine, tests — takes the interface as a
  dependency. This is what makes the failure/recovery UX demoable without
  waiting on real TTLs.
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

## Agent skills

See `.claude/skills/README.md` for what's available in this repo, and
`.claude/skills/verify-domain-flow/SKILL.md` for the end-to-end regression
loop (boot the app, drive the verification flow with Playwright, capture
screenshots).

`AGENTS.md` in this repo is a symlink to this file — either name works.
