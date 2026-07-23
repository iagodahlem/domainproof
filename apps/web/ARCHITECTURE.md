# Architecture — apps/web

This is the layer map for `apps/web`: where new code goes, and how the
shape is enforced. It's a peer to the root [`ARCHITECTURE.md`](../../ARCHITECTURE.md),
which explicitly leaves `apps/web` out of its own map — this doc is what
fills that gap, in the same register.

## Layer map

```txt
packages/ui/src/                   # generic, brand-styled primitives — zero app/business knowledge
  button.tsx, card.tsx, table.tsx, header.tsx, ...   #   cva variants, tokens only — no Clerk, no next/navigation, no fetch
  index.ts                                            #   barrel export — the only public surface

apps/web/
  app/                              # ROUTING ONLY — every file here is a Next.js route file or that route's own private helper
    (marketing)/                      # public, signed-out routes — route group, shares one marketing layout
      page.tsx                          #   landing page
      sso-callback/page.tsx
      design-system/
        page.tsx                          #   internal-only showcase route
        _components/                      #   path-chooser-demo.tsx
      layout.tsx
    (dashboard)/                      # authenticated routes — route group, mounts the QueryProvider once
      new/
        page.tsx
        _components/                     #   private to /new — never imported from any other route
          create-project-flow.tsx, keys-handoff.tsx, api-error-state.tsx
      dashboard/
        page.tsx                          #   thin redirect stub (old bookmarks, post-signin redirect) — hands off to [projectId]'s own active-project resolution
      [projectId]/                      # project routes live at the root (Vercel/Resend-style), not nested under /dashboard
        layout.tsx                        #   resolves active project, mounts <DashboardShell>
        loading.tsx
        domains/_components/             #   domains-page-client.tsx, domain-detail-client.tsx, add-domain-form.tsx, delete-confirm.tsx, domain-empty-state.tsx, domain-provider.tsx, domain-status.ts, domain-status-steps.tsx, domain-check-outcome.ts, domain-event-log.ts, format-relative-time.ts
        events/_components/                  #   events-view.tsx, event-row.tsx
        settings/_components/                #   settings-view.tsx, api-keys-card.tsx, project-name-card.tsx
        webhooks/_components/                #   webhooks-view.tsx, create-endpoint-form.tsx, delivery-log.tsx, endpoint-row.tsx
      layout.tsx
    layout.tsx                        # root layout — <html>, Clerk provider only, no visible chrome of its own

  components/                       # APP-LEVEL SHARED — used by 2+ routes; a closed set, not a dumping ground
    header/                            #   auth-cta.tsx, google-icon.tsx, marketing-actions.tsx, marketing-brand.tsx — the marketing Header's left/right-slot content
    footer/                            #   marketing-footer.tsx — shared by the landing and design-system pages
    dashboard-shell/                   #   every dashboard route's chrome
      shell.tsx, sidebar.tsx, topbar.tsx, user-menu.tsx, project-switcher.tsx,
      sign-out-button.tsx, reload-button.tsx, shell-skeleton.tsx, nav-items.ts

  lib/
    api/                              # thin fetch client — the only place that builds a request or parses the error envelope
      request.ts                        #   shared fetch wrapper + ApiError (unchanged)
      dashboard.ts                       #   dashboardApi — one method per /dashboard/* endpoint (unchanged)
    query/                            # the TanStack Query hook layer wrapping lib/api; the only thing client components call
      provider.tsx                       #   QueryProvider — mounted once from the (dashboard) group layout
      errors.ts                          #   re-exports ApiError, so components never import lib/api just for instanceof checks
      projects.ts, keys.ts, webhooks.ts  #   one file per resource, mirroring lib/api/dashboard.ts's own grouping
    slug-preview.ts                   # pure util, no fetch — stays flat at lib root
```

`Header` itself is a generic primitive in `packages/ui` (it takes arbitrary
`left`/`right` slots) — there's no app-level Header wrapper to maintain in
`apps/web`. `components/header/` holds the marketing pages' own slot
content (`AuthCta`, the `GoogleIcon` it renders, `MarketingActions` — the
theme-toggle + CTA cluster — and `MarketingBrand` — the logo + Docs link
pair), promoted out of route-private status because it's the natural
companion to every route's own `<Header left=... right=... />`
composition. `components/footer/` holds `MarketingFooter` for the same
reason — the landing and design-system pages render the identical footer
as the last thing on the page, so it earns app-level status rather than
living in either route's own `_components/`.

## Where does X go?

| Task                                                                                              | Goes in                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| New UI primitive with no business meaning (a `Badge` variant, a new `Table` cell type)            | `packages/ui/src/<name>.tsx` (+ export from `index.ts`) — only if it stays app-agnostic (no Clerk, no `next/navigation`, no `fetch`)            |
| New component used by exactly one route                                                           | That route's own `_components/<name>.tsx` — never `apps/web/components/`                                                                        |
| New component you're building for one route today but expect another route to need soon           | Still that route's `_components/` — promote it to `apps/web/components/` the day a second real call site appears, not before                    |
| New piece of the dashboard shell (nav item, topbar affordance, sidebar element)                   | `apps/web/components/dashboard-shell/<name>.tsx`                                                                                                |
| New piece of the shared Header's slot content (a marketing-only or dashboard-only CTA)            | `apps/web/components/header/<name>.tsx`                                                                                                         |
| New piece of the shared marketing footer's content                                                | `apps/web/components/footer/<name>.tsx`                                                                                                         |
| New dashboard API endpoint the web app needs to call                                              | A new method on `apps/web/lib/api/dashboard.ts` (or a new `lib/api/<plane>.ts` file if it's a different plane)                                  |
| New client-side data need (fetch/refetch/mutate from a `'use client'` component)                  | A new hook in `apps/web/lib/query/<resource>.ts`, wrapping the matching `lib/api` call — the component calls the hook, never `lib/api` directly |
| Initial-render data a server component/layout/page needs                                          | Call `lib/api` directly, same as today — no hook needed, there's no client cache to seed                                                        |
| New pure helper with no fetch/React (formatting, parsing, `slugPreview`-style)                    | `apps/web/lib/<name>.ts`, flat                                                                                                                  |
| New route-private non-component helper (a route's own formatter, a constant only that route uses) | That route's own `_lib/<name>.ts`                                                                                                               |
| New marketing-only or dashboard-only route                                                        | Inside the matching route group                                                                                                                 |
| New internal/dev-only route (a showcase, a debug page)                                            | Its own top-level `app/<name>/` folder, outside both route groups, with its own `_components/`                                                  |

## Naming conventions

- **Route-private folders are always `_components/` (React components) and
  `_lib/` (non-component helpers)** — Next's own private-folder convention,
  so they're never mistaken for a routable segment and (per Enforcement
  below) never reachable through the `@/` root alias from outside their own
  route.
- **`apps/web/components/` subfolders are named for what they are, not
  "misc."** `header/` and `dashboard-shell/` are closed sets, the same way
  an api module's root file set is closed (root `ARCHITECTURE.md`'s "Module
  anatomy") — a new file lands there only if it's genuinely part of that
  shell/header, not because it's "kind of dashboard-related."
- **Query hooks are named `use<Verb><Resource>`** (`useCreateProject`,
  `useRotateOrRevokeApiKey`, `useWebhookDeliveries`), one file per resource
  in `lib/query/`, deliberately mirroring `lib/api/dashboard.ts`'s own
  per-resource method grouping.

## Enforcement

- **`no-restricted-imports`** (see `apps/web/eslint.config.mjs`) mechanically
  enforces two shapes:
  1. **No aliased cross-route private imports.** `@/app/*/_components/**`,
     `@/app/**/_components/**`, `@/app/*/_lib/**`, and `@/app/**/_lib/**`
     are banned repo-wide. A route only ever imports its own private folder
     by relative path (`./_components/x`, `../_components/x`) — no
     legitimate colocated usage ever needs the alias to reach one. The
     residual gap this can't cheaply catch — a relative import that climbs
     from one route into a sibling's private folder — is what the
     `frontend-reviewer` agent's rule 16 exists for instead.
  2. **Client components consume data through the query layer, not
     `lib/api` directly.** `apps/web/components/**` and
     `apps/web/app/**/_components/**` may not import `@/lib/api/*` as a
     value — only `@/lib/query/*` (type-only imports of response shapes
     like `ProjectSummary` are allowed, since those are the vocabulary the
     whole component tree passes around as props). Route files themselves
     (`page.tsx`/`layout.tsx`/`loading.tsx`) are the exception, same as only
     a module's `repository.ts` is allowed to import `@infra/db` on the api
     side. `lib/query/**` may import `@/lib/api/*` — that's its entire job.
  - **Known, explicit exception:** `EventsView`'s `loadMore` still
    hand-rolls its own fetch/state rather than going through `lib/query` —
    converting it is a real behavior change (new request
    de-duplication/caching semantics via TanStack Query), not a structural
    move, so it's deliberately deferred to an immediate follow-on PR. The
    import is marked with an inline `eslint-disable-next-line` rather than
    silently exempted.
- **The `frontend-reviewer` agent** (`.claude/agents/frontend-reviewer.md`)
  reviews what eslint can't cheaply express: a component earning its place
  in `apps/web/components/` by actual cross-route use rather than
  anticipated use, and the residual cross-route private-import case
  described above.
