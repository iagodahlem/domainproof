---
name: infra-ops
description: Agent-invocable runbook for DomainProof's production infra — Railway (apps/api), Vercel (apps/web), Neon (Postgres), Cloudflare (DNS + WAF), Clerk, and Resend. Covers checking deploy status/logs, triggering redeploys, adding custom domains, managing DNS records safely, how env vars flow to each host, DB operation danger levels, and incident basics. Use this before touching any hosting/DNS/env config, or when diagnosing a production incident.
---

# Infra ops

Where DomainProof's production pieces live, and how to operate them without
guessing. Every command below reads a credential by name from the repo
root's gitignored `.env` — see [Secrets handling](#secrets-handling) first,
and `.env.example` at the repo root for the full list of names.

## Where everything lives

| Component  | Provider   | Notes                                                                           |
| ---------- | ---------- | ------------------------------------------------------------------------------- |
| `apps/api` | Railway    | Project-token auth. GraphQL API at `backboard.railway.com/graphql/v2`.          |
| `apps/web` | Vercel     | Next.js app — dashboard, docs, demo, hosted verification page.                  |
| Postgres   | Neon       | `DATABASE_URL` is a Neon connection string.                                     |
| DNS + WAF  | Cloudflare | Zone `domainproof.dev`. REST API at `api.cloudflare.com/client/v4`.             |
| Auth       | Clerk      | Dev instance → local + staging. Prod instance → production. Separate key pairs. |
| Email      | Resend     | Sends from `notifications@domainproof.dev`; DKIM/SPF already live in the zone.  |

## Secrets handling

Read this before anything else in this file.

- Secrets live **only** in the gitignored root `.env` (never `apps/api/.env`
  for infra-ops purposes — that file is the API's own runtime config and is
  a separate concern). Copy `.env.example` to `.env` and fill in real values;
  `.env` is already covered by the root `.gitignore`'s `.env` / `.env.*` /
  `!.env.example` rules.
- Load it into a shell before running anything below:

  ```bash
  set -a; . .env; set +a
  ```

- Never echo a secret value, never commit one, never paste one into a
  file, commit message, PR description, or chat — including this skill
  file. Every example below references a var by `$NAME`, never a literal.
- If a credential may have been exposed (pasted somewhere, printed in a
  log, committed and force-pushed away), rotate it at the provider and
  update `.env` — don't wait for confirmation that it leaked.
- `DEMO_API_KEY` is the one exception to "treat as sensitive": it's a
  `dp_test_` key, disposable by design, regenerated every time
  `db:seed` runs (see [DB operations](#db-operations)). Don't reuse it for
  anything that matters, but it's not an incident if it changes.

## Railway: deploy status, logs, redeploy

Auth is a single header, not `Authorization: Bearer`:

```bash
curl -s https://backboard.railway.com/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -d '{"query": "{ __typename }"}'
```

**The User-Agent header is load-bearing.** Cloudflare's WAF sits in front
of Railway's API and 403s requests with a non-browser UA — curl with an
explicit standard UA (above) works; Python's `urllib` (default UA
`Python-urllib/x.y`) gets blocked outright. If you're scripting this from
something other than curl, set a browser-like UA explicitly or route
through curl.

Railway's GraphQL schema does shift over time and the exact field names
below are best-effort, not guaranteed current. If one of these errors with
a schema mismatch, introspect first and fix this file with the corrected
shape before proceeding:

```bash
curl -s https://backboard.railway.com/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -d '{"query": "{ __schema { mutationType { fields { name } } } }"}'
```

**Deploy status:**

```bash
curl -s https://backboard.railway.com/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -d "{\"query\": \"query(\$p: String!, \$s: String!, \$e: String!) { deployments(input: { projectId: \$p, serviceId: \$s, environmentId: \$e }) { edges { node { id status createdAt } } } }\", \"variables\": {\"p\": \"$RAILWAY_PROJECT_ID\", \"s\": \"$RAILWAY_SERVICE_ID\", \"e\": \"$RAILWAY_ENVIRONMENT_ID\"}}"
```

**Logs for a specific deployment** (grab an `id` from the query above):

```bash
curl -s https://backboard.railway.com/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -d "{\"query\": \"query(\$d: String!) { deploymentLogs(deploymentId: \$d, limit: 200) { timestamp message severity } }\", \"variables\": {\"d\": \"<deployment-id>\"}}"
```

Faster path for a one-off look: Railway dashboard → project → service →
Deployments → open a deployment → View Logs. Use the API form above when
you need to grep/pipe programmatically or from an agent session.

**Trigger a redeploy** (redeploys the current image against the service's
latest build, not a rollback):

```bash
curl -s https://backboard.railway.com/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -d "{\"query\": \"mutation(\$s: String!, \$e: String!) { serviceInstanceDeploy(serviceId: \$s, environmentId: \$e) }\", \"variables\": {\"s\": \"$RAILWAY_SERVICE_ID\", \"e\": \"$RAILWAY_ENVIRONMENT_ID\"}}"
```

**Rollback to a previous deployment** doesn't have a documented mutation
here — do it from the dashboard: Deployments → select the older healthy
one → Redeploy. It's the fastest path during an incident; don't spend time
hunting for the GraphQL equivalent while the API is down.

`apps/api`'s migrations run on boot (see [DB operations](#db-operations)) —
a redeploy that starts and then immediately restarts in a loop usually
means a migration or `env.ts` validation is failing. Check logs before
retrying the redeploy.

## Adding a custom domain end-to-end

1. **Check the plan cap first.** Railway custom domains are capped per
   plan/service — adding one may need a plan upgrade or freeing an unused
   slot (dashboard → service → Settings → Domains shows current usage).
   Don't start the Cloudflare/env steps below until you know there's room.
2. **Create the domain on Railway** (GraphQL `customDomainCreate`,
   `serviceId`/`environmentId`/`domain` in the input — confirm the exact
   input shape via introspection if it's changed). The response includes
   the CNAME target Railway wants and a verification token.
3. **Cloudflare CNAME.** Create the CNAME record pointing the new hostname
   at Railway's target. Railway terminates TLS itself for custom domains,
   so this record needs to be **DNS-only (grey cloud)**, not proxied —
   Cloudflare defaults new records to proxied (orange cloud), so switch it
   explicitly.
4. **Cloudflare verify TXT.** Create the `_railway-verify.<host>` TXT
   record Railway's response gave you, so Railway can confirm you control
   the DNS. Wait for Railway to show the domain as verified/active before
   moving on.
5. **Set the plane's host env var** on the Railway service —
   `PUBLIC_API_HOST`, `DASHBOARD_API_HOST`, or `FRONTEND_API_HOST` (see
   `apps/api/src/shared/middlewares/host-restriction.ts`) — to the new
   hostname, matching whichever plane it's meant to serve. Redeploy if the
   var change doesn't trigger one automatically.

### Hostname pattern

Plane hosts nest under the api subdomain: `api.domainproof.dev` (public
plane, `/v1/*`) and `dashboard.api.domainproof.dev` (`/dashboard/*`) are
live/in-progress today. Any new plane host follows
`<plane>.api.domainproof.dev`.

**Resolved (2026-07-22):** the frontend plane runs on its own custom domain,
`frontend.api.domainproof.dev` — provisioned after the plan upgrade lifted
the custom-domain cap, keeping the documented one-plane-per-host contract.
A consolidation PR that would have served `/frontend/*` on the public host
was closed unmerged once the dedicated host became possible. Any lingering
`verify.domainproof.dev` references in older docs are stale — that name was
never provisioned.

**Creating a new service in this project — three gotchas that already
burned a night:**

- New Railway services default to the Railpack builder, which cannot infer
  a start command from this monorepo's root. The api builds from
  `apps/api/Dockerfile`, selected via a service variable:
  `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`. Set it BEFORE the first
  deploy or the build fails with "railpack process exited with an error".
- A deploy triggered at service creation races the variables — set every
  variable first, then trigger the deploy (a first FAILED deploy right
  after `serviceCreate` usually just means it built before `DATABASE_URL`
  existed).
- Project tokens are environment-scoped and cannot create environments —
  that's why staging is a second SERVICE (`api-staging`, Railway-generated
  domain) inside the production environment, not a separate environment:
  Neon branch database, dev-instance Clerk JWKS, no host restriction.

## Cloudflare DNS

Auth: `Authorization: Bearer $CLOUDFLARE_API_TOKEN`. Zone-scoped, so every
call includes `$CLOUDFLARE_ZONE_ID`.

```bash
# List records (optionally filter, e.g. &type=TXT&name=_railway-verify.api.domainproof.dev)
curl -s "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# Create a record
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"<host>","content":"<target>","proxied":false}'

# Update a record (id from the list call above)
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/<record-id>" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"<new-target>"}'
```

**Never delete a record you didn't create this session.** The zone also
carries DKIM/SPF records Resend depends on and `_railway-verify.*` records
other custom domains depend on — a wrong guess about what's safe to remove
breaks email delivery or an unrelated domain's TLS silently, not loudly.
If a record looks stale or wrong, list it, note its id, and ask before
deleting rather than cleaning it up unilaterally.

WAF rules live in the same Cloudflare zone/API but aren't covered by a
specific procedure here — check the dashboard (Security → WAF) if a
production symptom looks like an edge block (a 403 with Cloudflare's own
error page, not the API's `{ error: { code, message } }` shape) rather
than an application error.

## How env vars flow

- **Railway** (`apps/api`): service-level variables, dashboard → service →
  Variables. This is what `apps/api/src/env.ts` reads at boot — every name
  in `apps/api/.env.example` has a matching Railway variable in
  production. Changing a variable normally triggers a redeploy; confirm in
  the deployments list rather than assuming.
- **Vercel** (`apps/web`): project-level variables, dashboard → project →
  Settings → Environment Variables, scoped per Vercel environment
  (Production / Preview / Development). Anything the browser needs must be
  `NEXT_PUBLIC_`-prefixed (e.g. the Clerk publishable key).
- **Clerk dev vs prod**: the dev instance's keys (`CLERK_DEV_*` in the root
  `.env.example`) go on local dev, Vercel Preview, and any Railway staging
  environment — they map to the platform's own `CLERK_SECRET_KEY` /
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` names. The prod instance's keys
  (`CLERK_PROD_*`) go only on Vercel Production and Railway's production
  environment. Don't cross the two — a prod secret key on a preview
  deployment (or vice versa) is a real security gap, not just a bug.

## DB operations

From `apps/api`, ordered by how dangerous they are:

- **Migrations run automatically on boot** (`src/index.ts` runs them
  before the server starts serving) — there's no manual migrate step in
  production. If a deploy comes up unhealthy, check the logs for a
  migration failure before assuming it's anything else.
- `pnpm --filter api db:migrate` — apply migrations against whatever
  `DATABASE_URL` points at. Safe, idempotent, used in CI and local dev.
- `pnpm --filter api db:seed` — seeds a demo account, a project, and its
  test/live API keys (printed once, not retrievable after). This is where
  `DEMO_API_KEY` gets minted — update wherever the demo app reads it after
  running this. Refuses to run if a demo account already exists.
- `pnpm --filter api db:reset -- --yes` — **destructive.** Drops and
  recreates the `public` schema, wiping all data, then reapplies every
  migration from scratch. Prints the target host before doing anything —
  read that line and confirm it's the throwaway database you think it is,
  not a shared or production `DATABASE_URL`, before this ever runs against
  a remote host.

## Incident basics

- **Health check:** `GET /health` on any host — it's the one route exempt
  from `host-restriction.ts`, so it answers on `api.domainproof.dev`,
  `dashboard.api.domainproof.dev`, and Railway's own `*.up.railway.app`
  domain alike. Returns `{ status: "ok", version }`.
- **Logs:** structured JSON via pino, verbosity controlled by `LOG_LEVEL`.
  Pull them from the Railway dashboard (service → Deployments → View Logs)
  or the `deploymentLogs` GraphQL query above.
- **First pass on "the API is down":**
  1. `curl -sf https://api.domainproof.dev/health` (and the other plane
     hosts, if the symptom is host-specific).
  2. Check Railway deploy status — is the latest deployment healthy, or
     stuck restarting?
  3. Check recent deploys/redeploys — did something just ship?
  4. Check Neon's status for the project if `/health` itself is failing
     with a DB-shaped error.
  5. If the failure looks like an edge block (Cloudflare's own error page,
     not the api's JSON error shape) rather than an application error,
     check Cloudflare (WAF rules, zone status) before assuming the app is
     broken.
- **Fastest rollback:** Railway dashboard → Deployments → pick the last
  known-good deployment → Redeploy. Faster than debugging forward during
  an active incident.
