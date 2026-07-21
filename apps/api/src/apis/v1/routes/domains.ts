import { Hono } from 'hono'
import { z } from 'zod'
import { DEFAULT_TOKEN_TTL_MS } from '@domainproof/core'
import type { ApiKeyAuthVariables } from '../middlewares/api-key'
import type {
  DomainsService,
  DomainSummary,
  VerifyDomainCheck,
} from '@modules/domains/service'
import type { EventSummary, EventsService } from '@modules/events/service'
import { apiError } from '@shared/http-errors'

// 253 is the maximum length of a fully-qualified DNS domain name (RFC
// 1035/1123: 255 octets on the wire, minus 2 for the root label and
// length-prefix overhead a dotted hostname string doesn't itself encode).
// Anything longer can never be a valid hostname, so it's rejected here
// rather than spending a `normalizeDomain` call (or, worse, a DNS query)
// on it.
const MAX_DOMAIN_LENGTH = 253

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

const claimDomainBodySchema = z.object({
  domain: z.string().min(1).max(MAX_DOMAIN_LENGTH),
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
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    verifiedAt: summary.verifiedAt,
    verificationUrl: `${VERIFICATION_BASE_URL}/${summary.id}`,
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

  router.post('/', async (c) => {
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
  })

  router.get('/', async (c) => {
    const domains = await domainsService.listDomains(
      c.get('projectId'),
      c.get('mode'),
    )
    return c.json({ domains: domains.map(serializeDomain) })
  })

  router.get('/:id', async (c) => {
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
  })

  router.get('/:id/events', async (c) => {
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
  })

  router.delete('/:id', async (c) => {
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
  })

  router.post('/:id/verify', async (c) => {
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
  })

  router.post('/:id/regenerate', async (c) => {
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
  })

  return router
}
