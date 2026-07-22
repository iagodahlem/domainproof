import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { SessionAuthVariables } from '../middlewares/session-auth'
import type { ProjectsService } from '@modules/projects/service'
import type {
  DomainsService,
  DomainSummary,
  VerifyDomainCheck,
} from '@modules/domains/service'
import type { ProviderForDomain } from '@modules/domains/ports'
import type { EventSummary, EventsService } from '@modules/events/service'
import { apiError } from '@shared/http-errors'

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 100

// 253 is the maximum length of a fully-qualified DNS domain name — see
// `apis/v1/routes/domains.ts`'s identical constant for the full rationale.
// Duplicated rather than imported: presentation/validation constants are a
// plane concern, same as `RECORD_TYPE_BY_METHOD` below — `apis/dashboard`
// and `apis/v1` never import from each other (ARCHITECTURE.md).
const MAX_DOMAIN_LENGTH = 253

// Duplicated from `apis/v1/routes/domains.ts`'s identical constant — same
// cross-plane-import restriction as `MAX_DOMAIN_LENGTH` above.
const MAX_EXTERNAL_ID_LENGTH = 256

// Shared by every cursor-paginated GET on this router (the domains list
// below and `/:domainId/events`).
const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(MAX_PAGE_LIMIT).optional(),
  cursor: z.string().min(1).optional(),
})

// The domains list's own query schema: `listQuerySchema`'s pagination
// fields plus the `external_id` filter, which only makes sense here, not on
// the events list. Stays snake_case on the wire (query param and the create
// body's `external_id`) rather than following this plane's otherwise-
// camelCase convention — see the identical note in
// `apis/v1/routes/domains.ts`.
const listDomainsQuerySchema = listQuerySchema.extend({
  external_id: z.string().min(1).max(MAX_EXTERNAL_ID_LENGTH).optional(),
  // The dashboard's test/live mode toggle. Optional — omitted returns both
  // modes mixed, same as before this filter existed.
  mode: z.enum(['test', 'live']).optional(),
})

const createDomainBodySchema = z.object({
  domain: z.string().min(1).max(MAX_DOMAIN_LENGTH),
  // Unlike the public API (where `mode` comes from which key — test or
  // live — authenticated the request), the dashboard has no api key in
  // play, so the caller states the mode explicitly.
  mode: z.enum(['test', 'live']),
  external_id: z.string().min(1).max(MAX_EXTERNAL_ID_LENGTH).optional(),
})

const RECORD_TYPE_BY_METHOD: Record<string, string> = {
  dns_txt: 'TXT',
}

const VERIFICATION_BASE_URL = 'https://domainproof.dev/verify'

const INVALID_DOMAIN_MESSAGES: Record<string, string> = {
  empty: 'Domain is required.',
  invalid_format: 'Domain is not a valid hostname.',
  is_ip: 'Domain must be a hostname, not an IP address.',
  no_public_suffix: 'Domain has no recognized public suffix.',
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

function conflict() {
  return {
    body: apiError(
      'domain_already_claimed',
      'This domain is already claimed for this project in this mode. List existing domains, or release the existing claim before reclaiming it.',
    ),
    status: 409 as const,
  }
}

function sandboxRequiresTestMode() {
  return {
    body: apiError(
      'sandbox_requires_test_mode',
      'Sandbox domains are only available in test mode.',
    ),
    status: 400 as const,
  }
}

function invalidStatus() {
  return {
    body: apiError(
      'invalid_status',
      'Only pending or failed domains can have their challenge regenerated.',
    ),
    status: 409 as const,
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
    external_id: summary.externalId,
    method: summary.challenges[0]?.method ?? null,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    verifiedAt: summary.verifiedAt,
  }
}

/**
 * The dashboard's domain detail view: the summary fields plus the current
 * challenge's record instructions (what to publish to prove ownership) and
 * the hosted verification portal's URL, mirroring the public API's
 * `records`-as-data shape (`apis/v1/routes/domains.ts`'s `serializeDomain`)
 * but without that route's API-consumer-facing copy — the dashboard UI
 * writes its own. Also the create/verify/regenerate/delete write routes'
 * response shape, not just this file's read routes — one serializer for
 * every route that returns a full domain.
 */
function serializeDomainDetail(summary: DomainSummary) {
  return {
    ...serializeDomainSummary(summary),
    verificationUrl: `${VERIFICATION_BASE_URL}/${summary.frontendToken}`,
    records: summary.challenges.map((challenge) => ({
      type: RECORD_TYPE_BY_METHOD[challenge.method] ?? challenge.method,
      name: challenge.recordHost,
      value: challenge.recordValue,
      status: summary.status === 'not_started' ? 'pending' : summary.status,
    })),
  }
}

/**
 * The dashboard's view of one `verifyDomain` attempt: the outcome and when,
 * plus the expected/detected value diff for `wrong_value` — no baked-in
 * prose `explanation` like the public API's `serializeCheck` (see
 * `apis/v1/routes/domains.ts`), since that copy is written by the
 * dashboard UI itself.
 */
function serializeCheck(check: VerifyDomainCheck) {
  return {
    outcome: check.outcome,
    checkedAt: check.checkedAt,
    ...(check.outcome === 'wrong_value'
      ? { expected: check.expectedValue, detected: check.detectedValues }
      : {}),
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
 * Dashboard-facing domain routes, mounted at `/projects/:projectId/domains`
 * under the dashboard plane's router (giving
 * `/dashboard/projects/:projectId/domains`) — the full domain lifecycle
 * (claim, verify, regenerate a challenge, release) for the dashboard's own
 * pages, alongside the list/detail/event-timeline reads. Every route
 * resolves `:projectId` against the caller's account via
 * `projectsService.resolveOwnedProject`, same anti-enumeration stance as
 * `routes/keys.ts`: a `projectId` (or, once resolved, a `domainId`)
 * belonging to another account always 404s.
 *
 * The write routes call the exact same `modules/domains` use cases the
 * public API's `apis/v1/routes/domains.ts` calls — `claimDomain`,
 * `verifyProjectDomain`/`releaseProjectDomain`/`regenerateProjectChallenge`
 * (the project-scoped counterparts of `verifyDomain`/`releaseDomain`/
 * `regenerateChallenge`, since this plane has no api-key `mode` to further
 * scope by) — never a parallel implementation of verification or
 * persistence logic. Only the HTTP-facing presentation (response copy,
 * error wording) differs per plane, same as the read routes'
 * `serializeDomainDetail` already does.
 *
 * Session auth is applied once for the whole plane in
 * `apis/dashboard/router.ts` — by the time a handler here runs,
 * `c.get("userId")` is already set.
 */
export function createDomainsRoutes(
  domainsService: DomainsService,
  eventsService: EventsService,
  projectsService: ProjectsService,
  providerForDomain: ProviderForDomain,
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

  router.post('/', async (c) => {
    const json = await c.req.json().catch(() => undefined)
    const parsed = createDomainBodySchema.safeParse(json)

    if (!parsed.success) {
      const { body, status } = invalidRequest('Invalid request body')
      return c.json(body, status)
    }

    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const result = await domainsService.claimDomain({
      projectId,
      mode: parsed.data.mode,
      domain: parsed.data.domain,
      externalId: parsed.data.external_id,
    })

    if (!result.ok) {
      if (result.error === 'invalid_domain') {
        const { body, status } = invalidRequest(
          INVALID_DOMAIN_MESSAGES[result.reason] ?? 'Domain is invalid.',
        )
        return c.json(body, status)
      }

      if (result.error === 'sandbox_requires_test_mode') {
        const { body, status } = sandboxRequiresTestMode()
        return c.json(body, status)
      }

      const { body, status } = conflict()
      return c.json(body, status)
    }

    return c.json({ domain: serializeDomainDetail(result.domain) }, 201)
  })

  router.get('/', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const parsed = listDomainsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      const { body, status } = invalidRequest('Invalid query parameters')
      return c.json(body, status)
    }

    const { domains, nextCursor } = await domainsService.listProjectDomains(
      projectId,
      {
        limit: parsed.data.limit ?? DEFAULT_PAGE_LIMIT,
        cursor: parsed.data.cursor,
        externalId: parsed.data.external_id,
        mode: parsed.data.mode,
      },
    )

    // Provider detection is a list-view presentation concern (the domains
    // table's Provider column), not a domain fact — resolved here rather
    // than folded into `serializeDomainSummary`, so the write routes below
    // (which reuse that same serializer) don't each pay for an NS lookup
    // their response never renders.
    const domainsWithProvider = await Promise.all(
      domains.map(async (domain) => ({
        ...serializeDomainSummary(domain),
        provider: await providerForDomain(domain.domain),
      })),
    )

    return c.json({ domains: domainsWithProvider, nextCursor })
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

  router.post('/:domainId/verify', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const result = await domainsService.verifyProjectDomain(
      projectId,
      c.req.param('domainId'),
    )
    if (!result.ok) {
      const { body, status } = domainNotFound()
      return c.json(body, status)
    }

    return c.json({
      domain: serializeDomainDetail(result.domain),
      check: serializeCheck(result.check),
    })
  })

  router.post('/:domainId/regenerate', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const result = await domainsService.regenerateProjectChallenge(
      projectId,
      c.req.param('domainId'),
    )
    if (!result.ok) {
      if (result.error === 'not_found') {
        const { body, status } = domainNotFound()
        return c.json(body, status)
      }

      const { body, status } = invalidStatus()
      return c.json(body, status)
    }

    return c.json({ domain: serializeDomainDetail(result.domain) })
  })

  router.delete('/:domainId', async (c) => {
    const projectId = await resolveProjectId(c)
    if (!projectId) {
      const { body, status } = projectNotFound()
      return c.json(body, status)
    }

    const domain = await domainsService.releaseProjectDomain(
      projectId,
      c.req.param('domainId'),
    )
    if (!domain) {
      const { body, status } = domainNotFound()
      return c.json(body, status)
    }

    return c.json({ domain: serializeDomainDetail(domain) })
  })

  return router
}
