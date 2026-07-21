import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { SessionAuthVariables } from '../middlewares/session-auth'
import type { ProjectsService } from '@modules/projects/service'
import type {
  EventsService,
  ProjectEventSummary,
} from '@modules/events/service'
import { apiError } from '@shared/http-errors'

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 100

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(MAX_PAGE_LIMIT).optional(),
  cursor: z.string().min(1).optional(),
})

function projectNotFound() {
  return {
    body: apiError('not_found', 'Project not found'),
    status: 404 as const,
  }
}

function invalidRequest(message: string) {
  return {
    body: apiError('invalid_request', message),
    status: 400 as const,
  }
}

function serializeEvent(event: ProjectEventSummary) {
  return {
    id: event.id,
    type: event.type,
    domain: event.domain,
    mode: event.mode,
    payload: event.payload,
    createdAt: event.createdAt,
  }
}

/**
 * Dashboard-facing project-wide events read, mounted at
 * `/projects/:projectId/events` under the dashboard plane's router (giving
 * `/dashboard/projects/:projectId/events`) — the table the dashboard's
 * events page renders: every event across all of a project's domains and
 * both modes, newest first. Per-domain timelines still live at
 * `/projects/:projectId/domains/:domainId/events`
 * (`apis/dashboard/routes/domains.ts`); this is the project-wide superset
 * a single domain's page doesn't need. Resolves `:projectId` against the
 * caller's account via `projectsService.resolveOwnedProject`, same
 * anti-enumeration stance as `routes/domains.ts`: an unknown or unowned
 * `projectId` always 404s.
 *
 * Session auth is applied once for the whole plane in
 * `apis/dashboard/router.ts` — by the time a handler here runs,
 * `c.get("userId")` is already set.
 */
export function createEventsRoutes(
  eventsService: EventsService,
  projectsService: ProjectsService,
) {
  const router = new Hono<{ Variables: SessionAuthVariables }>()

  async function resolveProjectId(
    c: Context<{ Variables: SessionAuthVariables }>,
  ): Promise<string | undefined> {
    // The route is only ever mounted under `/projects/:projectId/events`
    // (see `apis/dashboard/router.ts`), so `projectId` is always present
    // at runtime — same as `routes/domains.ts`'s identically-shaped
    // helper.
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

  router.get('/', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const parsed = listQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      const { body, status } = invalidRequest('Invalid query parameters')
      return c.json(body, status)
    }

    const { events, nextCursor } = await eventsService.listProjectEvents(
      projectId,
      {
        limit: parsed.data.limit ?? DEFAULT_PAGE_LIMIT,
        cursor: parsed.data.cursor,
      },
    )

    return c.json({ events: events.map(serializeEvent), nextCursor })
  })

  return router
}
