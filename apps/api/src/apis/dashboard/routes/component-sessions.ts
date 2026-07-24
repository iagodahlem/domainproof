import { Hono, type Context } from 'hono'
import type { SessionAuthVariables } from '../middlewares/session-auth'
import type { ProjectsService } from '@modules/projects/service'
import type { ComponentSessionsService } from '@modules/component-sessions/service'
import { apiError } from '@shared/http-errors'

function projectNotFound() {
  return {
    body: apiError('not_found', 'Project not found'),
    status: 404 as const,
  }
}

/**
 * Dashboard-facing component-session minting, mounted at
 * `/projects/:projectId/component-sessions` under the dashboard plane's
 * router — the same {@link ComponentSessionsService} the public v1 plane's
 * `/v1/component-sessions` mints from, just authenticated by the caller's
 * Clerk session (via `projectsService.resolveOwnedProject`) instead of an
 * api key. Exists so the dashboard's own onboarding walkthrough can render
 * the real `@domainproof/react` `<DomainVerification />` against a real
 * session token without the browser ever holding this project's api key —
 * the same reason a builder's own backend mints one for their frontend.
 * Always `mode: 'test'`: the walkthrough only ever claims the `.test`
 * sandbox domain, so there's no live-mode use for this route yet.
 */
export function createComponentSessionsRoutes(
  componentSessionsService: ComponentSessionsService,
  projectsService: ProjectsService,
) {
  const router = new Hono<{ Variables: SessionAuthVariables }>()

  async function resolveProjectId(
    c: Context<{ Variables: SessionAuthVariables }>,
  ): Promise<string | undefined> {
    const projectId = c.req.param('projectId')
    if (!projectId) {
      return undefined
    }

    return projectsService.resolveOwnedProject(
      c.get('userId'),
      projectId,
      c.get('userEmail'),
    )
  }

  router.post('/', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const result = await componentSessionsService.createSession({
      projectId,
      mode: 'test',
    })

    return c.json(
      {
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt.toISOString(),
      },
      201,
    )
  })

  return router
}
