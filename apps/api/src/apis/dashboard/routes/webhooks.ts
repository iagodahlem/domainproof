import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { SessionAuthVariables } from '../middlewares/session-auth'
import type { ProjectsService } from '@modules/projects/service'
import {
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from '@modules/webhooks/domain/event-types'
import type { WebhooksService } from '@modules/webhooks/service'
import { apiError } from '@shared/http-errors'

const DEFAULT_DELIVERIES_PAGE_LIMIT = 20
const MAX_DELIVERIES_PAGE_LIMIT = 100

const eventTypeSchema = z.enum(
  WEBHOOK_EVENT_TYPES as [WebhookEventType, ...WebhookEventType[]],
)

const createEndpointBodySchema = z.object({
  url: z.string().url(),
  mode: z.enum(['test', 'live']),
  eventTypes: z.array(eventTypeSchema).min(1),
})

const listDeliveriesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_DELIVERIES_PAGE_LIMIT)
    .optional(),
  cursor: z.string().min(1).optional(),
})

function projectNotFound() {
  return {
    body: apiError('not_found', 'Project not found'),
    status: 404 as const,
  }
}

function endpointNotFound() {
  return {
    body: apiError('not_found', 'Webhook endpoint not found'),
    status: 404 as const,
  }
}

function deliveryNotFound() {
  return {
    body: apiError('not_found', 'Webhook delivery not found'),
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
 * Dashboard-facing webhook endpoint management and delivery-log routes,
 * mounted at `/projects/:projectId/webhooks` under the dashboard plane's
 * router (giving `/dashboard/projects/:projectId/webhooks`). Every route
 * resolves `:projectId` against the caller's account via
 * `projectsService.resolveOwnedProject`, same anti-enumeration stance as
 * `routes/keys.ts`/`routes/domains.ts`: a `projectId` (or, once resolved,
 * an `endpointId`/`deliveryId`) belonging to another account always 404s.
 *
 * Session auth is applied once for the whole plane in
 * `apis/dashboard/router.ts`, not here. Parses/validates input, calls the
 * injected services, and maps the result to HTTP — no db or business logic
 * here; that's `webhooksService`'s job (backed by its own module's
 * repository), and actual delivery dispatch happens out-of-band as a bus
 * subscriber (see `modules/webhooks/service.ts`'s doc comment), not from
 * any route in this file.
 */
export function createWebhooksRoutes(
  webhooksService: WebhooksService,
  projectsService: ProjectsService,
) {
  const router = new Hono<{ Variables: SessionAuthVariables }>()

  async function resolveProjectId(
    c: Context<{ Variables: SessionAuthVariables }>,
  ): Promise<string | undefined> {
    // The route is only ever mounted under `/projects/:projectId/webhooks`
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

  router.post('/', async (c) => {
    const json = await c.req.json().catch(() => undefined)
    const parsed = createEndpointBodySchema.safeParse(json)

    if (!parsed.success) {
      const { body, status } = invalidRequest('Invalid request body')
      return c.json(body, status)
    }

    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const result = await webhooksService.createEndpoint(
      projectId,
      parsed.data.mode,
      parsed.data.url,
      parsed.data.eventTypes,
    )

    return c.json(result, 201)
  })

  router.get('/', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const endpoints = await webhooksService.listEndpoints(projectId)

    return c.json({ endpoints })
  })

  router.delete('/:endpointId', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const endpoint = await webhooksService.deleteEndpoint(
      projectId,
      c.req.param('endpointId'),
    )
    if (!endpoint) {
      const { body, status } = endpointNotFound()
      return c.json(body, status)
    }

    return c.json({ endpoint })
  })

  router.post('/:endpointId/disable', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const endpoint = await webhooksService.disableEndpoint(
      projectId,
      c.req.param('endpointId'),
    )
    if (!endpoint) {
      const { body, status } = endpointNotFound()
      return c.json(body, status)
    }

    return c.json({ endpoint })
  })

  router.post('/:endpointId/enable', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const endpoint = await webhooksService.enableEndpoint(
      projectId,
      c.req.param('endpointId'),
    )
    if (!endpoint) {
      const { body, status } = endpointNotFound()
      return c.json(body, status)
    }

    return c.json({ endpoint })
  })

  router.get('/:endpointId/deliveries', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const parsed = listDeliveriesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      const { body, status } = invalidRequest('Invalid query parameters')
      return c.json(body, status)
    }

    const result = await webhooksService.listDeliveries(
      projectId,
      c.req.param('endpointId'),
      {
        limit: parsed.data.limit ?? DEFAULT_DELIVERIES_PAGE_LIMIT,
        cursor: parsed.data.cursor,
      },
    )
    if (!result) {
      const { body, status } = endpointNotFound()
      return c.json(body, status)
    }

    return c.json(result)
  })

  router.post('/:endpointId/deliveries/:deliveryId/redeliver', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const delivery = await webhooksService.redeliver(
      projectId,
      c.req.param('endpointId'),
      c.req.param('deliveryId'),
    )
    if (!delivery) {
      const { body, status } = deliveryNotFound()
      return c.json(body, status)
    }

    return c.json({ delivery }, 201)
  })

  return router
}
