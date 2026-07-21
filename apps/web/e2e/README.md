# Signup flow e2e

Drives the full signup + bootstrap loop (landing → Google sign-in → locked
create-project → keys handoff → dashboard placeholder) against a live local
web + api stack, using `@clerk/testing` to sign in with a Clerk-issued
sign-in ticket instead of a real Google OAuth screen.

This is a separate script from the default `pnpm turbo run test` — it needs
real servers and a database up first, so it isn't part of the turbo
pipeline.

## Prerequisites

- The dev Clerk instance's keys (`CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) in `apps/web/.env`.
- `apps/api/.env` pointed at a throwaway Postgres, plus `CLERK_JWKS_URL`/
  `CLERK_ISSUER` for the same Clerk instance (see the main README's env
  table — the Frontend API host in both derives from the publishable key).

## Run it

```bash
# 1. A throwaway Postgres (any port not already in use locally):
docker run -d --name domainproof-e2e-db \
  -e POSTGRES_USER=domainproof -e POSTGRES_PASSWORD=domainproof -e POSTGRES_DB=domainproof \
  -p 5434:5432 postgres:17-alpine

# 2. Point apps/api/.env's DATABASE_URL at it, then migrate:
pnpm --filter api db:migrate

# 3. Boot both apps (pick free ports if 3000/3001 are taken locally):
pnpm --filter api dev            # PORT in apps/api/.env
PORT=4000 pnpm --filter web dev  # matches NEXT_PUBLIC_API_URL + E2E_WEB_URL

# 4. Run the suite:
E2E_WEB_URL=http://localhost:4000 pnpm --filter web test:e2e
```

`global-setup.ts` creates one fresh Clerk test user via the Backend API
before the suite runs and `global-teardown.ts` deletes it afterward — no
manual seeding needed. Tear down the throwaway Postgres container when
done (`docker rm -f domainproof-e2e-db`).
