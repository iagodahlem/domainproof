import { Hono } from 'hono'
import { z } from 'zod'
import type { SessionAuthVariables } from '../middlewares/session-auth'
import type { ProjectsService } from '@modules/projects/service'
import { apiError } from '@shared/http-errors'

const createProjectBodySchema = z.object({
  name: z.string().min(1).max(200),
})

function invalidRequest(message: string) {
  return {
    body: apiError('invalid_request', message),
    status: 400 as const,
  }
}

/**
 * Dashboard-facing project routes, mounted at `/projects` under the
 * dashboard plane's router (giving `/dashboard/projects`). `POST` is the
 * explicit bootstrap moment for a builder's first project: it mints both a
 * test and a live API key alongside the project, atomically, and returns
 * both one-time full key strings — the only response where they're ever
 * shown together. `GET` lists the caller's projects (empty for a fresh
 * account, before they've created one).
 *
 * Session auth is applied once for the whole plane in
 * `apis/dashboard/router.ts` — by the time a handler here runs,
 * `c.get("userId")` is already set.
 */
export function createProjectsRoutes(projectsService: ProjectsService) {
  const router = new Hono<{ Variables: SessionAuthVariables }>()

  router.get('/', async (c) => {
    const projects = await projectsService.listProjects(
      c.get('userId'),
      c.get('userEmail'),
    )

    return c.json({ projects })
  })

  router.post('/', async (c) => {
    const json = await c.req.json().catch(() => undefined)
    const parsed = createProjectBodySchema.safeParse(json)

    if (!parsed.success) {
      const { body, status } = invalidRequest('Invalid request body')
      return c.json(body, status)
    }

    const result = await projectsService.createProject(
      c.get('userId'),
      parsed.data.name,
      c.get('userEmail'),
    )

    return c.json(result, 201)
  })

  return router
}
