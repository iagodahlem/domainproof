import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { DomainsService } from '@modules/domains/service'
import type { ProviderForDomain } from '@modules/domains/ports'
import type { EventsService } from '@modules/events/service'
import type { ProjectsService } from '@modules/projects/service'
import type { ComponentSessionsService } from '@modules/component-sessions/service'
import type { CloudflareOAuthService } from '@modules/cloudflare/service'
import { createVerificationsRoutes } from './routes/verifications'
import { createComponentSessionsRoutes } from './routes/component-sessions'
import { createCloudflareRoutes } from './routes/cloudflare'

export interface FrontendRouterDeps {
  domainsService: DomainsService
  eventsService: EventsService
  projectsService: ProjectsService
  componentSessionsService: ComponentSessionsService
  providerForDomain: ProviderForDomain
  /** `undefined` when `CLOUDFLARE_OAUTH_CLIENT_ID`/`CLOUDFLARE_OAUTH_CLIENT_SECRET` aren't configured — see `env.ts`. */
  cloudflareOAuthService: CloudflareOAuthService | undefined
}

/**
 * The Frontend API plane root (`/frontend/*`) — named after Clerk's FAPI:
 * it serves the builders' *customers* and DomainProof's own frontends (the
 * hosted verification page today, drop-in React components later), not
 * builders themselves. Unlike `apis/dashboard` (a login session) and
 * `apis/v1` (a project api key), this plane has no per-request auth
 * middleware to apply here — the credential is the unguessable
 * `frontendToken` embedded in each route's own `:token` path param, scoped
 * to exactly one domain claim (see `infra/db/schema.ts`'s doc comment).
 * There is nothing broader to authenticate at the plane level, so there's
 * no `router.use('*', ...)` here the way the other two planes have.
 *
 * `/verifications` (read a claim's status, trigger a bounded re-check,
 * read its event timeline) is the first route group on this plane.
 * `/component-sessions` is the second: it spends the single-use tokens
 * minted by `POST /v1/component-sessions`, letting a drop-in component
 * claim a domain with no api key of its own — see
 * `routes/component-sessions.ts`. `/cloudflare` is the third: the
 * one-click DNS setup flow's callback (`GET /cloudflare/callback`) — its
 * sibling authorize route lives under `/verifications/:token/cloudflare/authorize`
 * instead, since it's scoped to one claim the same way every other route
 * under `/verifications` is (see `routes/cloudflare.ts`'s doc comment for
 * why the callback itself can't be nested the same way).
 *
 * This is the one plane that answers `fetch` calls from a browser on a
 * third-party origin — the hosted verification page (from its own origin)
 * and, eventually, a builder's drop-in component (from whatever origin
 * that builder's app runs on) — so it's the one plane with CORS applied
 * here. Scoped to this plane's own `router.ts` rather than
 * `shared/middlewares/`, so it can never leak onto `apis/v1` (server-to-
 * server — deliberately answers no CORS headers at all, since a browser
 * has no business calling it directly) or `apis/dashboard` (whose own,
 * separately-scoped CORS is out of scope for this change — each plane
 * wires its own `cors()` independently in its own `router.ts`, so there's
 * no shared CORS config to conflict with here). Any origin is allowed
 * here because the credential is the unguessable `:token`/`:sessionToken`
 * in the URL, not a cookie — `credentials: false` (the default, spelled
 * out here) means no `Access-Control-Allow-Credentials` header is ever
 * sent, so a browser won't attach cookies to these requests even
 * cross-origin. `maxAge` lets a browser cache a preflight for a day
 * instead of re-asking before every request.
 */
export function createFrontendRouter(deps: FrontendRouterDeps) {
  const router = new Hono()

  router.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST'],
      credentials: false,
      maxAge: 86400,
    }),
  )

  router.route(
    '/verifications',
    createVerificationsRoutes(
      deps.domainsService,
      deps.eventsService,
      deps.projectsService,
      deps.providerForDomain,
      deps.cloudflareOAuthService,
    ),
  )

  router.route(
    '/component-sessions',
    createComponentSessionsRoutes(
      deps.componentSessionsService,
      deps.projectsService,
      deps.providerForDomain,
    ),
  )

  router.route(
    '/cloudflare',
    createCloudflareRoutes(deps.cloudflareOAuthService),
  )

  return router
}
