import { Hono } from 'hono'
import { z } from 'zod'
import type { SessionAuthVariables } from '../middlewares/session-auth'
import type { ProjectsService } from '@modules/projects/service'
import { apiError } from '@shared/http-errors'

/** Shared with `PATCH /:projectId` — a rename uses the same name rules as creation. */
const projectNameBodySchema = z.object({
  name: z.string().min(1).max(200),
})

function invalidRequest(message: string) {
  return {
    body: apiError('invalid_request', message),
    status: 400 as const,
  }
}

function projectNotFound() {
  return {
    body: apiError('not_found', 'Project not found'),
    status: 404 as const,
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
 * `c.get("userId")` is already set. `PATCH /:projectId` renames a project;
 * it resolves ownership the same way `keys`/`domains` routes do via
 * `resolveOwnedProject`, so an unknown or unowned id 404s rather than 403s.
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
    const parsed = projectNameBodySchema.safeParse(json)

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

  router.patch('/:projectId', async (c) => {
    const json = await c.req.json().catch(() => undefined)
    const parsed = projectNameBodySchema.safeParse(json)

    if (!parsed.success) {
      const { body, status } = invalidRequest('Invalid request body')
      return c.json(body, status)
    }

    const projectId = await projectsService.resolveOwnedProject(
      c.get('userId'),
      c.req.param('projectId'),
      c.get('userEmail'),
    )
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const project = await projectsService.renameProject(
      projectId,
      parsed.data.name,
    )

    return c.json({ project })
  })

  return router
}
