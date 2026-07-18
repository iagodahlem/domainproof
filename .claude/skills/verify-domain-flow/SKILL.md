---
name: verify-domain-flow
description: End-to-end regression loop for the domain verification flow — boots api + web locally, drives the happy path and a failure-then-recovery path through the dashboard and hosted verification page via Playwright, and captures screenshots at each step. Use this before a PR that touches packages/core, apps/api, or apps/web's verification UI, or any time you need fresh evidence that the verification loop still works.
---

# Verify domain flow

Runs the full domain-verification loop against a local stack and captures
screenshots as evidence. This is the daily regression check and the source
of the screenshots referenced in the README.

Requires the Playwright MCP server (`.mcp.json` at repo root registers it —
run with `--headless --isolated`, no setup needed beyond `pnpm install`).

> **Status:** the dashboard's "add domain" flow and the hosted verification
> page don't exist yet. Steps below are written as if they do, with `TODO`
> markers on anything that depends on UI that isn't built. Once the
> dashboard and hosted verification page ship, remove the TODO markers and
> confirm selectors against the real DOM — this becomes fully runnable then.

## 1. Boot the stack

```bash
pnpm --filter api dev     # apps/api — default http://localhost:8787
pnpm --filter web dev     # apps/web — default http://localhost:3000
```

Wait for both to report ready before driving anything — the API's `/health`
route should return 200:

```bash
curl -sf http://localhost:8787/health
```

## 2. Happy path — pending to verified

1. Open `http://localhost:3000/dashboard` (TODO: confirm route once the
   dashboard shell lands — may be `/dashboard/domains`).
2. Sign in with a test Clerk account (TODO: document the seeded test user
   once auth is wired — for now use whatever dev-mode bypass exists).
3. Click "Add domain" and enter `pending-then-verified.test` — the `.test`
   TLD routes to the in-memory fixture resolver in `packages/core`, so this
   never touches real DNS. Confirm the fixture resolver is seeded to
   transition this exact hostname from `pending` to `verified` (see
   `packages/core/src/resolvers/fixture.ts` — TODO: exact fixture name may
   differ, check the file).
4. Screenshot: `.claude/artifacts/01-domain-added-pending.png`
   (TODO: confirm the dashboard shows a `pending` badge/status chip
   immediately after adding — selector likely `[data-status="pending"]`).
5. Open the hosted verification page for this domain — TODO: confirm URL
   shape, likely `http://localhost:3000/verify/<challenge-id>` or a
   public-facing route surfaced from the dashboard.
6. Screenshot: `.claude/artifacts/02-hosted-page-pending.png` — should show
   the expected TXT record value and the `_domainproof-challenge` label.
7. Click "Recheck now" (or wait for the background poll, whichever the UI
   exposes) and wait for the status to flip to `verified`.
8. Screenshot: `.claude/artifacts/03-hosted-page-verified.png`.
9. Back in the dashboard, confirm the domain row now shows `verified`.
10. Screenshot: `.claude/artifacts/04-dashboard-verified.png`.

## 3. Failure and recovery — wrong value to verified

1. Add a second domain: `wrong-value.test`. The fixture resolver seeds this
   one to return a TXT record with an incorrect value (simulating "pasted
   the wrong secret" or a stale record) — see the same fixture file as
   above for the exact scenario name.
2. Open its hosted verification page.
3. Trigger a check ("Recheck now" or wait for the poll) and confirm the UI
   surfaces a `wrong_value` failure state distinctly from `pending` or
   `not_started` — this distinction is the whole point of the exercise, not
   just "it failed."
4. Screenshot: `.claude/artifacts/05-wrong-value-failure.png`.
5. Regenerate the challenge token (or, if testing the fix path instead of
   regenerate, correct the record value in the fixture) and confirm the UI
   returns to a re-checkable state.
6. Screenshot: `.claude/artifacts/06-regenerated-token.png`.
7. Recheck and wait for `verified`.
8. Screenshot: `.claude/artifacts/07-recovered-to-verified.png`.

## 4. Wrap up

- Confirm all 7 screenshots exist in `.claude/artifacts/` (they're
  gitignored — this is a local/CI evidence step, not something that ships
  in the repo).
- If any step deviated from the TODO assumptions above, update this file
  with the real selector/route/fixture name so the next run doesn't have to
  rediscover it.
- Report anything that took more than one recheck cycle to resolve —
  DNS/fixture timing flakiness here is a real signal, not noise.
