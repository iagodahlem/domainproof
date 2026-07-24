# apps/web

Next.js 15 (App Router) — the only Next app in the DomainProof monorepo. One
deploy, several distinct surfaces:

- Landing page + project dashboard at the apex domain (`domainproof.dev`),
  project routes at the root (`/<projectId>/...`, not under a `/dashboard`
  prefix)
- The hosted, unauthenticated verification page at `/verify/[token]`
- Docs (hand-built on `next-mdx-remote` + `remark-gfm`) at `/docs`
- A demo consumer app, deliberately distinct branding, at `/demo` —
  consumes only the public SDK/API, never server internals

```bash
pnpm --filter web dev     # http://localhost:3000
pnpm --filter web test
pnpm --filter web build
```

See the root [README](../../README.md) for environment setup (including
the `/demo` app's `DEMO_DOMAINPROOF_API_KEY`) and the full API surface, and
[ARCHITECTURE.md](./ARCHITECTURE.md) for this app's layer map and where new
code goes.
