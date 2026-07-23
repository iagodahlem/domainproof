import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { KeysService } from '@modules/keys/service'
import type { ProjectsService } from '@modules/projects/service'
import type { DomainsService } from '@modules/domains/service'
import type { ProviderForDomain } from '@modules/domains/ports'
import type { EventsService } from '@modules/events/service'
import type { SessionVerifier } from '@modules/accounts/ports'
import type { WebhooksService } from '@modules/webhooks/service'
import type { ComponentSessionsService } from '@modules/component-sessions/service'
import {
  createSessionAuthMiddleware,
  type SessionAuthVariables,
} from './middlewares/session-auth'
import { createComponentSessionsRoutes } from './routes/component-sessions'
import { createDomainsRoutes } from './routes/domains'
import { createEventsRoutes } from './routes/events'
import { createKeysRoutes } from './routes/keys'
import { createProjectsRoutes } from './routes/projects'
import { createWebhooksRoutes } from './routes/webhooks'

export interface DashboardRouterDeps {
  keysService: KeysService
  projectsService: ProjectsService
  domainsService: DomainsService
  providerForDomain: ProviderForDomain
  eventsService: EventsService
  webhooksService: WebhooksService
  componentSessionsService: ComponentSessionsService
  /** `undefined` means session auth isn't configured — every plane request 500s until it is. */
  sessionVerifier: SessionVerifier | undefined
  /**
   * Origin the dashboard web app is served from. This is the only plane a
   * browser calls directly (the web app's client components attach the
   * caller's Clerk session token and fetch cross-origin), so CORS is
   * scoped to just this router rather than applied app-wide. `undefined`
   * allows any origin — dev/test convenience, matching the "unset means
   * unrestricted" pattern `shared/middlewares/host-restriction.ts` uses.
   */
  webOrigin?: string
}

/**
 * The dashboard plane root: the session-authenticated backend of the
 * DomainProof dashboard app, unversioned since we control its only
 * consumer (see ARCHITECTURE.md's Route planes). CORS and session auth
 * are applied once here, for the whole plane — route files never wire
 * either themselves. CORS runs first: its preflight `OPTIONS` handling
 * must never be blocked by session auth, since a preflight request never
 * carries the caller's Authorization header.
 */
export function createDashboardRouter(deps: DashboardRouterDeps) {
  const router = new Hono<{ Variables: SessionAuthVariables }>()

  router.use(
    '*',
    cors({
      origin: deps.webOrigin ?? '*',
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
    }),
  )
  router.use('*', createSessionAuthMiddleware(deps.sessionVerifier))

  router.route('/projects', createProjectsRoutes(deps.projectsService))
  router.route(
    '/projects/:projectId/keys',
    createKeysRoutes(deps.keysService, deps.projectsService),
  )
  router.route(
    '/projects/:projectId/domains',
    createDomainsRoutes(
      deps.domainsService,
      deps.eventsService,
      deps.projectsService,
      deps.providerForDomain,
    ),
  )
  router.route(
    '/projects/:projectId/events',
    createEventsRoutes(deps.eventsService, deps.projectsService),
  )
  router.route(
    '/projects/:projectId/webhooks',
    createWebhooksRoutes(deps.webhooksService, deps.projectsService),
  )
  router.route(
    '/projects/:projectId/component-sessions',
    createComponentSessionsRoutes(
      deps.componentSessionsService,
      deps.projectsService,
    ),
  )

  return router
}
