import { Hono } from 'hono'
import { z } from 'zod'
import type { ComponentSessionsService } from '@modules/component-sessions/service'
import type { ProjectsService } from '@modules/projects/service'
import type { RateLimitVariables } from '@shared/middlewares/rate-limit'
import { apiError } from '@shared/http-errors'
import { createClaimRateLimitMiddlewares } from '../middlewares/component-session-rate-limit'
import { resolveProjectName, serializeVerification } from './verifications'

// Matches apis/v1/routes/domains.ts's MAX_DOMAIN_LENGTH — the maximum
// length of a fully-qualified DNS domain name.
const MAX_DOMAIN_LENGTH = 253

const claimBodySchema = z.object({
  domain: z.string().min(1).max(MAX_DOMAIN_LENGTH),
})

const INVALID_DOMAIN_MESSAGES: Record<string, string> = {
  empty: 'Domain is required.',
  invalid_format: 'Domain is not a valid hostname.',
  is_ip: 'Domain must be a hostname, not an IP address.',
  no_public_suffix: 'Domain has no recognized public suffix.',
}

/**
 * Anti-enumeration by construction, same stance as
 * `routes/verifications.ts`'s `verificationNotFound`: an unknown,
 * expired, and already-consumed session token are all indistinguishable
 * at `ComponentSessionsService.claimDomain` (see its doc comment), so
 * they all 404 identically here too.
 */
function sessionNotFound() {
  return {
    body: apiError('not_found', 'Component session not found'),
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
      'This domain is already claimed for this project in this mode.',
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

/**
 * Spends a component session, mounted at `/component-sessions` under the
 * frontend plane's router (giving `/frontend/component-sessions`) —
 * `POST /:sessionToken/claim` is the only route: a drop-in component's one
 * backend touchpoint after `POST /v1/component-sessions` minted the
 * session. No session, no api key: the unguessable `:sessionToken` is the
 * entire credential, and it's single-use (see
 * `modules/component-sessions/service.ts`'s `claimDomain`). On success,
 * returns the exact same shape `GET /frontend/verifications/:token` does
 * (see `serializeVerification`), plus the new claim's own `frontendToken`
 * — the component switches to the normal verification endpoints
 * (`/frontend/verifications/:token`) from there.
 */
export function createComponentSessionsRoutes(
  componentSessionsService: ComponentSessionsService,
  projectsService: ProjectsService,
) {
  const router = new Hono<{ Variables: RateLimitVariables }>()

  router.post(
    '/:sessionToken/claim',
    ...createClaimRateLimitMiddlewares(),
    async (c) => {
      const json = await c.req.json().catch(() => undefined)
      const parsed = claimBodySchema.safeParse(json)
      if (!parsed.success) {
        const { body, status } = invalidRequest('Invalid request body')
        return c.json(body, status)
      }

      // See routes/verifications.ts's identical `?? ''` note: a generic
      // rate-limit middleware ahead of this handler defeats Hono's
      // literal path-param typing for `:sessionToken`.
      const result = await componentSessionsService.claimDomain(
        c.req.param('sessionToken') ?? '',
        parsed.data.domain,
      )

      if (!result.ok) {
        if (result.error === 'session_not_found') {
          const { body, status } = sessionNotFound()
          return c.json(body, status)
        }
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

      const projectName = await resolveProjectName(
        projectsService,
        result.domain,
      )
      return c.json(
        {
          ...serializeVerification(
            result.domain,
            projectName,
            result.domain.lastCheck,
          ),
          frontendToken: result.domain.frontendToken,
        },
        201,
      )
    },
  )

  return router
}
