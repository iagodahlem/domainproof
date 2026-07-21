import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { SessionAuthVariables } from '../middlewares/session-auth'
import type { ProjectsService } from '@modules/projects/service'
import type { DomainsService, DomainSummary } from '@modules/domains/service'
import type { EventSummary, EventsService } from '@modules/events/service'
import { apiError } from '@shared/http-errors'

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 100

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(MAX_PAGE_LIMIT).optional(),
  cursor: z.string().min(1).optional(),
})

const RECORD_TYPE_BY_METHOD: Record<string, string> = {
  dns_txt: 'TXT',
}

function projectNotFound() {
  return {
    body: apiError('not_found', 'Project not found'),
    status: 404 as const,
  }
}

function domainNotFound() {
  return {
    body: apiError('not_found', 'Domain not found'),
    status: 404 as const,
  }
}

function invalidRequest(message: string) {
  return {
    body: apiError('invalid_request', message),
    status: 400 as const,
  }
}

/**
 * The dashboard's row shape for a domains table: status, mode, the
 * verification method of its current challenge (if any), and the
 * created/updated/verified timestamps — everything a list view renders,
 * without the record host/value detail the domain detail view needs.
 */
function serializeDomainSummary(summary: DomainSummary) {
  return {
    id: summary.id,
    domain: summary.domain,
    mode: summary.mode,
    status: summary.status,
    method: summary.challenges[0]?.method ?? null,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    verifiedAt: summary.verifiedAt,
  }
}

/**
 * The dashboard's domain detail view: the summary fields plus the current
 * challenge's record instructions (what to publish to prove ownership),
 * mirroring the public API's `records`-as-data shape (`apis/v1/routes/domains.ts`'s
 * `serializeDomain`) but without that route's API-consumer-facing copy —
 * the dashboard UI writes its own.
 */
function serializeDomainDetail(summary: DomainSummary) {
  return {
    ...serializeDomainSummary(summary),
    records: summary.challenges.map((challenge) => ({
      type: RECORD_TYPE_BY_METHOD[challenge.method] ?? challenge.method,
      name: challenge.recordHost,
      value: challenge.recordValue,
      status: summary.status === 'not_started' ? 'pending' : summary.status,
    })),
  }
}

function serializeEvent(event: EventSummary) {
  return {
    id: event.id,
    type: event.type,
    mode: event.mode,
    payload: event.payload,
    createdAt: event.createdAt,
  }
}

/**
 * Dashboard-facing domain read routes, mounted at
 * `/projects/:projectId/domains` under the dashboard plane's router (giving
 * `/dashboard/projects/:projectId/domains`) — the read side of the domains
 * module for the dashboard's own pages (list, detail, event timeline).
 * Every route resolves `:projectId` against the caller's account via
 * `projectsService.resolveOwnedProject`, same anti-enumeration stance as
 * `routes/keys.ts`: a `projectId` (or, once resolved, a `domainId`)
 * belonging to another account always 404s.
 *
 * Read-only: claiming, releasing, and verifying a domain stay the public
 * API's job (`apis/v1/routes/domains.ts`) — this plane only ever calls
 * `listProjectDomains`/`getProjectDomain`/`listDomainEvents`, never a write
 * use case.
 *
 * Session auth is applied once for the whole plane in
 * `apis/dashboard/router.ts` — by the time a handler here runs,
 * `c.get("userId")` is already set.
 */
export function createDomainsRoutes(
  domainsService: DomainsService,
  eventsService: EventsService,
  projectsService: ProjectsService,
) {
  const router = new Hono<{ Variables: SessionAuthVariables }>()

  async function resolveProjectId(
    c: Context<{ Variables: SessionAuthVariables }>,
  ): Promise<string | undefined> {
    // The route is only ever mounted under `/projects/:projectId/domains`
    // (see `apis/dashboard/router.ts`), so `projectId` is always present at
    // runtime — same as `routes/keys.ts`'s identically-shaped helper.
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

    const { domains, nextCursor } = await domainsService.listProjectDomains(
      projectId,
      {
        limit: parsed.data.limit ?? DEFAULT_PAGE_LIMIT,
        cursor: parsed.data.cursor,
      },
    )

    return c.json({ domains: domains.map(serializeDomainSummary), nextCursor })
  })

  router.get('/:domainId', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const domain = await domainsService.getProjectDomain(
      projectId,
      c.req.param('domainId'),
    )
    if (!domain) {
      const { body, status } = domainNotFound()
      return c.json(body, status)
    }

    return c.json({ domain: serializeDomainDetail(domain) })
  })

  router.get('/:domainId/events', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    // Reuses getProjectDomain purely for its `projectId` authorization — a
    // `domainId` from another project 404s here the same way it does on
    // the detail route above, before ever reaching the events module.
    const domain = await domainsService.getProjectDomain(
      projectId,
      c.req.param('domainId'),
    )
    if (!domain) {
      const { body, status } = domainNotFound()
      return c.json(body, status)
    }

    const parsed = listQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      const { body, status } = invalidRequest('Invalid query parameters')
      return c.json(body, status)
    }

    const { events, nextCursor } = await eventsService.listDomainEvents(
      domain.id,
      {
        limit: parsed.data.limit ?? DEFAULT_PAGE_LIMIT,
        cursor: parsed.data.cursor,
      },
    )

    return c.json({ events: events.map(serializeEvent), nextCursor })
  })

  return router
}
