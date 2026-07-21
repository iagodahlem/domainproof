import { Hono } from 'hono'
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
 */
export function createFrontendRouter(deps: FrontendRouterDeps) {
  const router = new Hono()

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
