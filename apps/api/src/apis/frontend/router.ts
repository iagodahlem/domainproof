import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { DomainsService } from '@modules/domains/service'
import type { EventsService } from '@modules/events/service'
import type { ProjectsService } from '@modules/projects/service'
import type { ComponentSessionsService } from '@modules/component-sessions/service'
import { createVerificationsRoutes } from './routes/verifications'
import { createComponentSessionsRoutes } from './routes/component-sessions'

export interface FrontendRouterDeps {
  domainsService: DomainsService
  eventsService: EventsService
  projectsService: ProjectsService
  componentSessionsService: ComponentSessionsService
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
 * `routes/component-sessions.ts`.
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
    ),
  )

  router.route(
    '/component-sessions',
    createComponentSessionsRoutes(
      deps.componentSessionsService,
      deps.projectsService,
    ),
  )

  return router
}
