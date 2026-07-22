import { Hono } from 'hono'
import { z } from 'zod'
import { describeRoute, resolver } from 'hono-openapi'
import { DEFAULT_TOKEN_TTL_MS, DOMAIN_STATUSES } from '@domainproof/core'
import type { ApiKeyAuthVariables } from '../middlewares/api-key'
import type {
  DomainsService,
  DomainSummary,
  VerifyDomainCheck,
} from '@modules/domains/service'
import type { EventSummary, EventsService } from '@modules/events/service'
import { apiError } from '@shared/http-errors'
import {
  apiKeySecurity,
  apiKeyUnauthorizedResponse,
  errorResponse,
  rateLimitedResponse,
  toJsonSchema,
  toParameters,
} from '@shared/openapi'

// 253 is the maximum length of a fully-qualified DNS domain name (RFC
// 1035/1123: 255 octets on the wire, minus 2 for the root label and
// length-prefix overhead a dotted hostname string doesn't itself encode).
// Anything longer can never be a valid hostname, so it's rejected here
// rather than spending a `normalizeDomain` call (or, worse, a DNS query)
// on it.
const MAX_DOMAIN_LENGTH = 253

// The claiming project's own end-user identifier — an opaque string, no
// particular format expected, just a sane upper bound (matches
// `infra/db/schema.ts`'s `externalId` column).
const MAX_EXTERNAL_ID_LENGTH = 256

const DEFAULT_EVENTS_PAGE_LIMIT = 20
const MAX_EVENTS_PAGE_LIMIT = 100

const DEFAULT_DOMAINS_PAGE_LIMIT = 20
const MAX_DOMAINS_PAGE_LIMIT = 100

const listEventsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_EVENTS_PAGE_LIMIT)
    .optional(),
  cursor: z.string().min(1).optional(),
})

// `external_id`/`domain` stay snake_case/bare on the wire (query params and
// the claim body's `external_id`) rather than following this plane's
// otherwise-camelCase convention — `external_id` is a fixed integration
// term callers correlate against their own systems, not a shape this API
// invented, so it keeps the casing every other DomainProof surface (and
// most vendor APIs with an equivalent field) uses for it.
const listDomainsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_DOMAINS_PAGE_LIMIT)
    .optional(),
  cursor: z.string().min(1).optional(),
  external_id: z.string().min(1).max(MAX_EXTERNAL_ID_LENGTH).optional(),
  domain: z.string().min(1).max(MAX_DOMAIN_LENGTH).optional(),
})

const claimDomainBodySchema = z.object({
  domain: z.string().min(1).max(MAX_DOMAIN_LENGTH),
  external_id: z.string().min(1).max(MAX_EXTERNAL_ID_LENGTH).optional(),
})

const VERIFICATION_BASE_URL = 'https://domainproof.dev/verify'

const INVALID_DOMAIN_MESSAGES: Record<string, string> = {
  empty: 'Domain is required.',
  invalid_format: 'Domain is not a valid hostname.',
  is_ip: 'Domain must be a hostname, not an IP address.',
  no_public_suffix: 'Domain has no recognized public suffix.',
}

const RECORD_TYPE_BY_METHOD: Record<string, string> = {
  dns_txt: 'TXT',
}

function notFound() {
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
      'This domain is already claimed for this project in this mode. List existing domains with GET /v1/domains, or release the existing claim with DELETE /v1/domains/:id before reclaiming it.',
    ),
    status: 409 as const,
  }
}

function sandboxRequiresTestMode() {
  return {
    body: apiError(
      'sandbox_requires_test_mode',
      'Sandbox domains are only available with test keys.',
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
 * A record's own `status` mirrors the domain's real verification status
 * rather than collapsing everything non-`verified` into `pending` — a
 * `failed` or `temporarily_failed` domain should say so on its record too,
 * not read as "still pending" to a client that only looks at `records[]`.
 * `not_started` can't happen in practice (a challenge, and so a record,
 * only ever exists on a domain claimDomain has already moved to `pending`
 * or later — see states.ts), but is guarded to `pending` rather than
 * assumed, since this function's input type is the full `DomainStatus`
 * union.
 */
export function recordStatusFor(domainStatus: DomainSummary['status']) {
  return domainStatus === 'not_started' ? 'pending' : domainStatus
}

/**
 * Builds the public API's records-as-data view of a domain: what DNS
 * record(s) prove ownership, described as structured data (`type`, `name`,
 * `value`, `purpose`, `description`, `status`) rather than baked into copy
 * or a fixed UI — any client (dashboard, SDK, CLI, an agent) can render
 * verification requirements straight from the response instead of
 * hardcoding a shape per record type. This is presentation, not domain
 * fact, so it's built here in the v1 route layer from the plane-agnostic
 * `DomainSummary` the service returns, not inside `modules/domains`.
 */
function serializeDomain(summary: DomainSummary) {
  // The record proves control of the exact claimed hostname — see core's
  // `challengeHost`, which roots the record at `summary.domain` itself
  // rather than its registrable domain (eTLD+1).
  const provesControlOf = summary.domain
  const recordStatus = recordStatusFor(summary.status)

  return {
    id: summary.id,
    domain: summary.domain,
    mode: summary.mode,
    status: summary.status,
    external_id: summary.externalId,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    verifiedAt: summary.verifiedAt,
    verificationUrl: `${VERIFICATION_BASE_URL}/${summary.frontendToken}`,
    records: summary.challenges.map((challenge) => ({
      type: RECORD_TYPE_BY_METHOD[challenge.method] ?? challenge.method,
      name: challenge.recordHost,
      value: challenge.recordValue,
      purpose: 'ownership',
      description: `Proves control of ${provesControlOf}. This record does nothing else and can be removed after verification.`,
      status: recordStatus,
    })),
  }
}

/** `DEFAULT_TOKEN_TTL_MS` expressed the way a person reads it, for the `expired` explanation below — computed rather than hardcoded so the copy can't drift if the TTL ever changes. */
const VERIFICATION_WINDOW_HOURS = DEFAULT_TOKEN_TTL_MS / (60 * 60 * 1000)

/**
 * Plain-language copy for a `verifyDomain` check attempt that didn't reach a
 * definitive "yes, verified" answer — written to be read by the person who
 * just published a DNS record and is anxiously refreshing, not a developer:
 * reassuring about `not_found` (this is normal, not a mistake), honest
 * about `unreachable` (this is us, not you), and actionable about `expired`
 * (here's exactly what to do next). This is UI-facing presentation, not
 * domain fact, so — like `serializeDomain`'s record `description` — it's
 * built here in the v1 route layer from the plane-agnostic outcome the
 * service returns, not inside `modules/domains`.
 */
const CHECK_EXPLANATIONS: Record<
  'not_found' | 'unreachable' | 'expired',
  (domain: string) => string
> = {
  not_found: (domain) =>
    `No record found yet. DNS changes usually take a few minutes to appear — we checked ${domain}'s own nameservers to skip stale caches. Try verifying again shortly.`,
  unreachable: (domain) =>
    `We couldn't get a reliable answer from ${domain}'s DNS servers just now. This is usually temporary and not something wrong with your record — wait a moment and try verifying again.`,
  expired: () =>
    `This verification request expired after ${VERIFICATION_WINDOW_HOURS} hours. Claim the domain again to get a fresh verification code, then publish the new record.`,
}

/**
 * Builds the public API's view of one `verifyDomain` attempt: what the
 * check found and when, plus outcome-specific detail — the expected/detected
 * value diff for `wrong_value`, a humanized `explanation` for
 * `not_found`/`unreachable`/`expired`. `found` and (already-)`verified`
 * recheck outcomes carry no extra detail beyond the outcome and timestamp;
 * the updated `domain` in the response already says everything else.
 */
function serializeCheck(check: VerifyDomainCheck, domain: string) {
  return {
    outcome: check.outcome,
    checkedAt: check.checkedAt,
    ...(check.outcome === 'wrong_value'
      ? { expected: check.expectedValue, detected: check.detectedValues }
      : {}),
    ...(check.outcome === 'not_found' ||
    check.outcome === 'unreachable' ||
    check.outcome === 'expired'
      ? { explanation: CHECK_EXPLANATIONS[check.outcome](domain) }
      : {}),
  }
}

/**
 * Builds the public API's view of one timeline event — `domainId` is
 * omitted since it's already implied by the `:id` in the URL this is
 * nested under.
 */
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
 * OpenAPI response schemas mirroring this file's `serialize*` functions —
 * documentation only (nothing here is `.parse()`d against a real
 * response), kept next to the functions they describe so the two stay easy
 * to compare by eye. Shared across this file's `describeRoute(...)` calls
 * via `resolver()`, which promotes each `.meta({ ref })`'d schema to a
 * single named `components.schemas` entry instead of inlining a copy per
 * route.
 */
const recordDoc = z.object({
  type: z.string(),
  name: z.string(),
  value: z.string(),
  purpose: z.literal('ownership'),
  description: z.string(),
  status: z.enum(DOMAIN_STATUSES),
})

const domainDoc = z
  .object({
    id: z.string(),
    domain: z.string(),
    mode: z.enum(['test', 'live']),
    status: z.enum(DOMAIN_STATUSES),
    external_id: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    verifiedAt: z.iso.datetime().nullable(),
    verificationUrl: z.string(),
    records: z.array(recordDoc),
  })
  .meta({ ref: 'Domain' })

const domainEnvelopeDoc = z.object({ domain: domainDoc }).meta({
  ref: 'DomainEnvelope',
})

const domainListDoc = z
  .object({
    domains: z.array(domainDoc),
    nextCursor: z.string().nullable(),
  })
  .meta({ ref: 'DomainList' })

const checkDoc = z
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
    explanation: z.string().optional(),
  })
  .meta({ ref: 'Check' })

const verifyResultDoc = z
  .object({ domain: domainDoc, check: checkDoc })
  .meta({ ref: 'VerifyResult' })

const eventDoc = z
  .object({
    id: z.string(),
    type: z.string(),
    mode: z.enum(['test', 'live']),
    payload: z.unknown(),
    createdAt: z.iso.datetime(),
  })
  .meta({ ref: 'Event' })

const eventListDoc = z
  .object({
    events: z.array(eventDoc),
    nextCursor: z.string().nullable(),
  })
  .meta({ ref: 'EventList' })

/** Every route in this file is scoped to a `:id` path segment identifying the domain claim. */
const idPathParameter = toParameters(z.object({ id: z.string() }), 'path')

/**
 * Public-API domain claiming routes, mounted at `/domains` under the v1
 * plane's router (giving `/v1/domains`). `projectId` and `mode` come from
 * the api-key auth context set by `apis/v1/middlewares/api-key.ts` — every
 * route here is implicitly scoped to the authenticated key's project and
 * mode, the same test/live separation the rest of the public API uses.
 * Parses/validates input, calls the injected `DomainsService`/
 * `EventsService`, and maps the result to HTTP — no db or business logic
 * here.
 */
export function createDomainsRoutes(
  domainsService: DomainsService,
  eventsService: EventsService,
) {
  const router = new Hono<{ Variables: ApiKeyAuthVariables }>()

  router.post(
    '/',
    describeRoute({
      tags: ['Domains'],
      summary: 'Claim a domain',
      description:
        'Claims a domain for the authenticated key’s project and mode, issuing a fresh verification challenge. Accepts an optional `external_id` to correlate the claim with the calling project’s own end user.',
      security: apiKeySecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: toJsonSchema(claimDomainBodySchema) },
        },
      },
      responses: {
        201: {
          description: 'Domain claimed',
          content: {
            'application/json': { schema: resolver(domainEnvelopeDoc) },
          },
        },
        400: errorResponse(
          'Invalid request body, invalid domain, or a sandbox domain claimed with a live-mode key',
        ),
        401: apiKeyUnauthorizedResponse,
        409: errorResponse('Domain already claimed for this project and mode'),
        429: rateLimitedResponse,
      },
    }),
    async (c) => {
      const json = await c.req.json().catch(() => undefined)
      const parsed = claimDomainBodySchema.safeParse(json)

      if (!parsed.success) {
        const { body, status } = invalidRequest('Invalid request body')
        return c.json(body, status)
      }

      const result = await domainsService.claimDomain({
        projectId: c.get('projectId'),
        mode: c.get('mode'),
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

      return c.json({ domain: serializeDomain(result.domain) }, 201)
    },
  )

  router.get(
    '/',
    describeRoute({
      tags: ['Domains'],
      summary: 'List claimed domains',
      description:
        'Cursor-paginated list of domains claimed by the key’s project and mode. Filterable by `external_id` and/or `domain`.',
      security: apiKeySecurity,
      parameters: toParameters(listDomainsQuerySchema, 'query'),
      responses: {
        200: {
          description: 'A page of domains',
          content: { 'application/json': { schema: resolver(domainListDoc) } },
        },
        400: errorResponse('Invalid query parameters'),
        401: apiKeyUnauthorizedResponse,
        429: rateLimitedResponse,
      },
    }),
    async (c) => {
      const parsed = listDomainsQuerySchema.safeParse(c.req.query())
      if (!parsed.success) {
        const { body, status } = invalidRequest('Invalid query parameters')
        return c.json(body, status)
      }

      const { domains, nextCursor } = await domainsService.listDomains(
        c.get('projectId'),
        c.get('mode'),
        {
          limit: parsed.data.limit ?? DEFAULT_DOMAINS_PAGE_LIMIT,
          cursor: parsed.data.cursor,
          externalId: parsed.data.external_id,
          domain: parsed.data.domain,
        },
      )
      return c.json({ domains: domains.map(serializeDomain), nextCursor })
    },
  )

  router.get(
    '/:id',
    describeRoute({
      tags: ['Domains'],
      summary: 'Get a claimed domain',
      description:
        'Gets a claimed domain and its current verification record instructions.',
      security: apiKeySecurity,
      parameters: idPathParameter,
      responses: {
        200: {
          description: 'The domain',
          content: {
            'application/json': { schema: resolver(domainEnvelopeDoc) },
          },
        },
        404: errorResponse('Domain not found'),
        401: apiKeyUnauthorizedResponse,
        429: rateLimitedResponse,
      },
    }),
    async (c) => {
      const domain = await domainsService.getDomain(
        c.get('projectId'),
        c.get('mode'),
        c.req.param('id'),
      )
      if (!domain) {
        const { body, status } = notFound()
        return c.json(body, status)
      }
      return c.json({ domain: serializeDomain(domain) })
    },
  )

  router.get(
    '/:id/events',
    describeRoute({
      tags: ['Domains'],
      summary: 'List a domain’s event timeline',
      description:
        'Cursor-paginated timeline of events published for a domain (claimed, checks, transitions), oldest first.',
      security: apiKeySecurity,
      parameters: [
        ...idPathParameter,
        ...toParameters(listEventsQuerySchema, 'query'),
      ],
      responses: {
        200: {
          description: 'A page of events',
          content: { 'application/json': { schema: resolver(eventListDoc) } },
        },
        404: errorResponse('Domain not found'),
        400: errorResponse('Invalid query parameters'),
        401: apiKeyUnauthorizedResponse,
        429: rateLimitedResponse,
      },
    }),
    async (c) => {
      // Reuses getDomain purely for its (projectId, mode) authorization —
      // a `keyId` from another project (or the wrong mode) 404s here the
      // same way it does on every other domain-scoped route.
      const domain = await domainsService.getDomain(
        c.get('projectId'),
        c.get('mode'),
        c.req.param('id'),
      )
      if (!domain) {
        const { body, status } = notFound()
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

  router.delete(
    '/:id',
    describeRoute({
      tags: ['Domains'],
      summary: 'Release a domain claim',
      description: 'Releases a domain claim.',
      security: apiKeySecurity,
      parameters: idPathParameter,
      responses: {
        200: {
          description: 'The released domain',
          content: {
            'application/json': { schema: resolver(domainEnvelopeDoc) },
          },
        },
        404: errorResponse('Domain not found'),
        401: apiKeyUnauthorizedResponse,
        429: rateLimitedResponse,
      },
    }),
    async (c) => {
      const domain = await domainsService.releaseDomain(
        c.get('projectId'),
        c.get('mode'),
        c.req.param('id'),
      )
      if (!domain) {
        const { body, status } = notFound()
        return c.json(body, status)
      }
      return c.json({ domain: serializeDomain(domain) })
    },
  )

  router.post(
    '/:id/verify',
    describeRoute({
      tags: ['Domains'],
      summary: 'Run the verification check for a domain',
      description:
        'Runs the DNS check for a claim and returns the updated domain plus the check’s outcome. Safe to poll — re-runs the check every time it’s called.',
      security: apiKeySecurity,
      parameters: idPathParameter,
      responses: {
        200: {
          description: 'The check result and updated domain',
          content: {
            'application/json': { schema: resolver(verifyResultDoc) },
          },
        },
        404: errorResponse('Domain not found'),
        401: apiKeyUnauthorizedResponse,
        429: rateLimitedResponse,
      },
    }),
    async (c) => {
      const result = await domainsService.verifyDomain(
        c.get('projectId'),
        c.get('mode'),
        c.req.param('id'),
      )
      if (!result.ok) {
        const { body, status } = notFound()
        return c.json(body, status)
      }
      return c.json({
        domain: serializeDomain(result.domain),
        check: serializeCheck(result.check, result.domain.domain),
      })
    },
  )

  router.post(
    '/:id/regenerate',
    describeRoute({
      tags: ['Domains'],
      summary: 'Regenerate a domain’s verification challenge',
      description:
        'Issues a fresh challenge for a `pending` or `failed` domain, restarting verification.',
      security: apiKeySecurity,
      parameters: idPathParameter,
      responses: {
        200: {
          description: 'The domain with its fresh challenge',
          content: {
            'application/json': { schema: resolver(domainEnvelopeDoc) },
          },
        },
        404: errorResponse('Domain not found'),
        409: errorResponse(
          'Only pending or failed domains can have their challenge regenerated',
        ),
        401: apiKeyUnauthorizedResponse,
        429: rateLimitedResponse,
      },
    }),
    async (c) => {
      const result = await domainsService.regenerateChallenge(
        c.get('projectId'),
        c.get('mode'),
        c.req.param('id'),
      )
      if (!result.ok) {
        if (result.error === 'not_found') {
          const { body, status } = notFound()
          return c.json(body, status)
        }

        const { body, status } = invalidStatus()
        return c.json(body, status)
      }

      return c.json({ domain: serializeDomain(result.domain) })
    },
  )

  return router
}
