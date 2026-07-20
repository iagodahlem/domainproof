import { Hono } from 'hono'
import { z } from 'zod'
import type { ApiKeyAuthVariables } from '../middlewares/api-key'
import type {
  DomainsService,
  DomainSummary,
  VerifyDomainCheck,
} from '@modules/domains/service'
import { apiError } from '@shared/http-errors'

const claimDomainBodySchema = z.object({
  domain: z.string().min(1),
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
  const recordStatus = summary.status === 'verified' ? 'verified' : 'pending'

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
      description: `Proves you control ${summary.domain}. This record does nothing else and can be removed after verification.`,
      status: recordStatus,
    })),
  }
}

/**
 * Plain-language copy for a `verifyDomain` check attempt that didn't reach a
 * definitive answer — written to be read by the person who just published a
 * DNS record and is anxiously refreshing, not a developer: reassuring about
 * `not_found` (this is normal, not a mistake), honest about `unreachable`
 * (this is us, not you). This is UI-facing presentation, not domain fact,
 * so — like `serializeDomain`'s record `description` — it's built here in
 * the v1 route layer from the plane-agnostic outcome the service returns,
 * not inside `modules/domains`.
 */
const CHECK_EXPLANATIONS: Record<
  'not_found' | 'unreachable',
  (domain: string) => string
> = {
  not_found: (domain) =>
    `No record found yet. DNS changes usually take a few minutes to appear — we checked ${domain}'s own nameservers to skip stale caches. Try verifying again shortly.`,
  unreachable: (domain) =>
    `We couldn't get a reliable answer from ${domain}'s DNS servers just now. This is usually temporary and not something wrong with your record — wait a moment and try verifying again.`,
}

/**
 * Builds the public API's view of one `verifyDomain` attempt: what the
 * check found and when, plus outcome-specific detail — the expected/detected
 * value diff for `wrong_value`, a humanized `explanation` for
 * `not_found`/`unreachable`. `found` and (already-)`verified` recheck
 * outcomes carry no extra detail beyond the outcome and timestamp; the
 * updated `domain` in the response already says everything else.
 */
function serializeCheck(check: VerifyDomainCheck, domain: string) {
  return {
    outcome: check.outcome,
    checkedAt: check.checkedAt,
    ...(check.outcome === 'wrong_value'
      ? { expected: check.expectedValue, detected: check.detectedValues }
      : {}),
    ...(check.outcome === 'not_found' || check.outcome === 'unreachable'
      ? { explanation: CHECK_EXPLANATIONS[check.outcome](domain) }
      : {}),
  }
}

/**
 * Public-API domain claiming routes, mounted at `/domains` under the v1
 * plane's router (giving `/v1/domains`). `projectId` and `mode` come from
 * the api-key auth context set by `apis/v1/middlewares/api-key.ts` — every
 * route here is implicitly scoped to the authenticated key's project and
 * mode, the same test/live separation the rest of the public API uses.
 * Parses/validates input, calls the injected `DomainsService`, and maps
 * the result to HTTP — no db or business logic here.
 */
export function createDomainsRoutes(domainsService: DomainsService) {
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

  return router
}
