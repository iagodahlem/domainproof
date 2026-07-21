import { Hono } from 'hono'
import type { KeysService } from '@modules/keys/service'
import type { ProjectsService } from '@modules/projects/service'
import type { SessionVerifier } from '@modules/accounts/ports'
import {
  createSessionAuthMiddleware,
  type SessionAuthVariables,
} from './middlewares/session-auth'
import { createKeysRoutes } from './routes/keys'
import { createProjectsRoutes } from './routes/projects'

export interface DashboardRouterDeps {
  keysService: KeysService
  projectsService: ProjectsService
  /** `undefined` means session auth isn't configured — every plane request 500s until it is. */
  sessionVerifier: SessionVerifier | undefined
}

/**
 * The dashboard plane root: the session-authenticated backend of the
 * DomainProof dashboard app, unversioned since we control its only
 * consumer (see ARCHITECTURE.md's Route planes). Session auth is applied
 * once here, for the whole plane — route files never wire it themselves.
 */
export function createDashboardRouter(deps: DashboardRouterDeps) {
  const router = new Hono<{ Variables: SessionAuthVariables }>()

  router.use('*', createSessionAuthMiddleware(deps.sessionVerifier))

  router.route('/projects', createProjectsRoutes(deps.projectsService))
  router.route(
    '/projects/:projectId/keys',
    createKeysRoutes(deps.keysService, deps.projectsService),
  )

  return router
}
