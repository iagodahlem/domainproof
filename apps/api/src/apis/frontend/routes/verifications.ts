import { Hono } from 'hono'
import { z } from 'zod'
import { describeRoute, resolver } from 'hono-openapi'
import type { OpenAPIV3_1 } from 'openapi-types'
import { DOMAIN_STATUSES } from '@domainproof/core'
import type {
  DomainsService,
  DomainSummary,
  LastCheckSummary,
  VerifyDomainCheck,
} from '@modules/domains/service'
import type { EventSummary, EventsService } from '@modules/events/service'
import type { ProjectsService } from '@modules/projects/service'
import type { RateLimitVariables } from '@shared/middlewares/rate-limit'
import { apiError } from '@shared/http-errors'
import {
  errorResponse,
  rateLimitedResponse,
  toParameters,
} from '@shared/openapi'
import { createCheckRateLimitMiddlewares } from '../middlewares/token-rate-limit'

const DEFAULT_EVENTS_PAGE_LIMIT = 20
const MAX_EVENTS_PAGE_LIMIT = 100

const listEventsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_EVENTS_PAGE_LIMIT)
    .optional(),
  cursor: z.string().min(1).optional(),
})

const RECORD_TYPE_BY_METHOD: Record<string, string> = {
  dns_txt: 'TXT',
}

/**
 * Anti-enumeration by construction, same stance as the api-key middleware's
 * doc comment: an unknown token and a released domain's now-defunct token
 * both resolve to `undefined` at the repository layer (see
 * `modules/domains/repository.ts`'s `findByFrontendToken`), so both 404
 * identically here — nothing above this reads or branches on "does this
 * token exist" separately from "does it resolve to a domain".
 */
function verificationNotFound() {
  return {
    body: apiError('not_found', 'Verification not found'),
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
 * Shared by the GET read and the POST check response — see
 * `serializeVerification`'s doc comment for why the two must return
 * identical shapes.
 */
function serializeCheck(check: LastCheckSummary | VerifyDomainCheck | null) {
  if (!check) {
    return null
  }
  return {
    outcome: check.outcome,
    checkedAt: check.checkedAt,
    ...(check.outcome === 'wrong_value'
      ? { expected: check.expectedValue, detected: check.detectedValues }
      : {}),
  }
}

/**
 * The Frontend API's hosted-verification-page view of a domain claim: only
 * what the page renders — never an account id, project id, or key
 * material. `projectName` is the one project fact the page needs ("who
 * this belongs to"), not the project's internal id. Exported for reuse by
 * `routes/component-sessions.ts`'s claim response, which returns this
 * exact shape plus the claim's `frontendToken`.
 */
export function serializeVerification(
  domain: DomainSummary,
  projectName: string,
  check: LastCheckSummary | VerifyDomainCheck | null,
) {
  return {
    domain: domain.domain,
    mode: domain.mode,
    status: domain.status,
    projectName,
    records: domain.challenges.map((challenge) => ({
      label: challenge.recordHost,
      type: RECORD_TYPE_BY_METHOD[challenge.method] ?? challenge.method,
      value: challenge.recordValue,
    })),
    check: serializeCheck(check),
    updatedAt: domain.updatedAt,
  }
}

/**
 * Frontend-safe view of one timeline event — unlike `apis/v1`/`apis/dashboard`'s
 * `serializeEvent`, this never forwards the raw event payload verbatim: that
 * payload carries `projectId`/`domainId` (see `shared/events.ts`'s
 * `DomainEventPayload`), internal ids this plane's anti-enumeration stance
 * says never to expose. Only `outcome` (present on `domain.check_failed`) is
 * ever pulled out of it.
 */
function serializeEvent(event: EventSummary) {
  const payload = event.payload
  const outcome =
    payload && typeof payload === 'object' && 'outcome' in payload
      ? (payload as { outcome: unknown }).outcome
      : undefined

  return {
    id: event.id,
    type: event.type,
    mode: event.mode,
    createdAt: event.createdAt,
    ...(typeof outcome === 'string' ? { outcome } : {}),
  }
}

/** Exported for reuse by `routes/component-sessions.ts`'s claim response. */
export async function resolveProjectName(
  projectsService: ProjectsService,
  domain: DomainSummary,
): Promise<string> {
  const name = await projectsService.getProjectName(domain.projectId)
  if (name === undefined) {
    // Cannot happen: `domains.project_id` cascades on delete, so an
    // existing domain row always has an existing project row.
    throw new Error(`No project found for id ${domain.projectId}`)
  }
  return name
}

/**
 * OpenAPI response schemas mirroring `serializeVerification`/`serializeEvent`
 * above — documentation only, kept next to the functions they describe.
 * `verificationResponseDoc` is exported for reuse by
 * `routes/component-sessions.ts`'s claim response, which extends this exact
 * shape with the claim's own `frontendToken`.
 */
const frontendRecordDoc = z.object({
  label: z.string(),
  type: z.string(),
  value: z.string(),
})

const frontendCheckDoc = z
  .object({
    outcome: z.enum([
      'found',
      'wrong_value',
      'not_found',
      'unreachable',
      'expired',
    ]),
    checkedAt: z.iso.datetime(),
    expected: z.string().optional(),
    detected: z.array(z.string()).optional(),
  })
  .nullable()

export const verificationResponseDoc = z
  .object({
    domain: z.string(),
    mode: z.enum(['test', 'live']),
    status: z.enum(DOMAIN_STATUSES),
    projectName: z.string(),
    records: z.array(frontendRecordDoc),
    check: frontendCheckDoc,
    updatedAt: z.iso.datetime(),
  })
  .meta({ ref: 'Verification' })

const frontendEventDoc = z
  .object({
    id: z.string(),
    type: z.string(),
    mode: z.enum(['test', 'live']),
    createdAt: z.iso.datetime(),
    outcome: z.string().optional(),
  })
  .meta({ ref: 'FrontendEvent' })

const frontendEventListDoc = z
  .object({
    events: z.array(frontendEventDoc),
    nextCursor: z.string().nullable(),
  })
  .meta({ ref: 'FrontendEventList' })

/**
 * The unguessable `:token` path segment is this plane's entire credential
 * (see the route factory's doc comment below) — described here rather than
 * modeled as an OpenAPI security scheme, since there's no clean fit for
 * "bearer token embedded in a path parameter" in the security-scheme
 * vocabulary, and the parameter is already required and documented either
 * way.
 */
const tokenPathParameter: OpenAPIV3_1.ParameterObject[] = [
  {
    name: 'token',
    in: 'path',
    required: true,
    description:
      'The domain claim’s unguessable frontendToken (embedded in verificationUrl) — the sole credential for this plane.',
    schema: { type: 'string' },
  },
]

const notFoundResponse = errorResponse(
  'Unknown token, or a released domain’s now-defunct token',
)

/**
 * The Frontend API plane's routes, mounted at `/verifications` under
 * `apis/frontend/router.ts` (giving `/frontend/verifications`) —
 * token-scoped read + bounded re-check access to exactly one domain claim,
 * for the hosted verification page (and, later, drop-in components using
 * the same client-secret pattern). No session, no api key: the unguessable
 * `:token` in the URL is the entire credential (see
 * `infra/db/schema.ts`'s `frontendToken` doc comment), so every route here
 * resolves it via `domainsService.getDomainByFrontendToken`/
 * `verifyDomainByFrontendToken` and 404s identically for an unknown token,
 * a released domain, or any other lookup miss — never a distinguishable
 * response for "wrong token" vs. "right token, wrong something else",
 * since there is no "something else" once the token itself resolves.
 */
export function createVerificationsRoutes(
  domainsService: DomainsService,
  eventsService: EventsService,
  projectsService: ProjectsService,
) {
  const router = new Hono<{ Variables: RateLimitVariables }>()

  router.get(
    '/:token',
    describeRoute({
      tags: ['Verifications'],
      summary: 'Read a domain claim’s verification status',
      description:
        'Reads a claim’s status, record instructions, and last check outcome by its frontendToken.',
      // No formal security scheme: the unguessable `:token` path parameter
      // (documented above) is the entire credential — see this file's route
      // factory doc comment.
      security: [],
      parameters: tokenPathParameter,
      responses: {
        200: {
          description: 'The verification',
          content: {
            'application/json': { schema: resolver(verificationResponseDoc) },
          },
        },
        404: notFoundResponse,
      },
    }),
    async (c) => {
      const domain = await domainsService.getDomainByFrontendToken(
        c.req.param('token'),
      )
      if (!domain) {
        const { body, status } = verificationNotFound()
        return c.json(body, status)
      }

      const projectName = await resolveProjectName(projectsService, domain)
      return c.json(
        serializeVerification(domain, projectName, domain.lastCheck),
      )
    },
  )

  router.post(
    '/:token/check',
    describeRoute({
      tags: ['Verifications'],
      summary: 'Run the verification check for a domain claim',
      description:
        'Runs the DNS check for a claim (rate limited: 1 per 15s, 20 per hour, per token) and returns the same shape as the GET above.',
      security: [],
      parameters: tokenPathParameter,
      responses: {
        200: {
          description: 'The verification, after the check runs',
          content: {
            'application/json': { schema: resolver(verificationResponseDoc) },
          },
        },
        404: notFoundResponse,
        429: rateLimitedResponse,
      },
    }),
    ...createCheckRateLimitMiddlewares(),
    async (c) => {
      // Hono's literal path-param typing (`c.req.param('token')` -> `string`)
      // doesn't survive being combined with the externally-defined rate
      // limit middlewares above in one `router.post(...)` call — the `?? ''`
      // is a type-only fallback (an empty token never resolves to a domain,
      // so it 404s the same as any other unknown token).
      const result = await domainsService.verifyDomainByFrontendToken(
        c.req.param('token') ?? '',
      )
      if (!result.ok) {
        const { body, status } = verificationNotFound()
        return c.json(body, status)
      }

      const projectName = await resolveProjectName(
        projectsService,
        result.domain,
      )
      return c.json(
        serializeVerification(result.domain, projectName, result.check),
      )
    },
  )

  router.get(
    '/:token/events',
    describeRoute({
      tags: ['Verifications'],
      summary: 'List a domain claim’s event timeline',
      description:
        'Cursor-paginated timeline of events published for a domain, with no account/project ids in the payload.',
      security: [],
      parameters: [
        ...tokenPathParameter,
        ...toParameters(listEventsQuerySchema, 'query'),
      ],
      responses: {
        200: {
          description: 'A page of events',
          content: {
            'application/json': { schema: resolver(frontendEventListDoc) },
          },
        },
        404: notFoundResponse,
        400: errorResponse('Invalid query parameters'),
      },
    }),
    async (c) => {
      const domain = await domainsService.getDomainByFrontendToken(
        c.req.param('token'),
      )
      if (!domain) {
        const { body, status } = verificationNotFound()
        return c.json(body, status)
      }

      const parsed = listEventsQuerySchema.safeParse(c.req.query())
      if (!parsed.success) {
        const { body, status } = invalidRequest('Invalid query parameters')
        return c.json(body, status)
      }

      const { events, nextCursor } = await eventsService.listDomainEvents(
        domain.id,
        {
          limit: parsed.data.limit ?? DEFAULT_EVENTS_PAGE_LIMIT,
          cursor: parsed.data.cursor,
        },
      )

      return c.json({ events: events.map(serializeEvent), nextCursor })
    },
  )

  return router
}
