import { Hono } from 'hono'
import { z } from 'zod'
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
 * this belongs to"), not the project's internal id.
 */
function serializeVerification(
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

async function resolveProjectName(
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

  router.get('/:token', async (c) => {
    const domain = await domainsService.getDomainByFrontendToken(
      c.req.param('token'),
    )
    if (!domain) {
      const { body, status } = verificationNotFound()
      return c.json(body, status)
    }

    const projectName = await resolveProjectName(projectsService, domain)
    return c.json(serializeVerification(domain, projectName, domain.lastCheck))
  })

  router.post(
    '/:token/check',
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

  router.get('/:token/events', async (c) => {
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
  })

  return router
}
