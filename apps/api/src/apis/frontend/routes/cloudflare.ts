import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import type { OpenAPIV3_1 } from 'openapi-types'
import type {
  CloudflareCallbackOutcome,
  CloudflareOAuthService,
} from '@modules/cloudflare/service'
import { apiError } from '@shared/http-errors'
import { errorResponse } from '@shared/openapi'

/**
 * Matches `apis/v1/routes/domains.ts`/`apis/dashboard/routes/domains.ts`'s
 * own `VERIFICATION_BASE_URL` — duplicated locally rather than shared,
 * same convention those two files already use (a display/redirect-only
 * value, not worth a shared constant module for three call sites).
 */
const VERIFICATION_BASE_URL = 'https://domainproof.dev/verify'

/**
 * Documentation only — Cloudflare's own redirect, not a request this api
 * validates against a schema (see the handler's plain `c.req.query()`
 * destructure below), so these are hand-written rather than derived via
 * `toParameters` from a zod schema the way every other documented query
 * param in this repo is.
 */
const callbackQueryParameters: OpenAPIV3_1.ParameterObject[] = [
  {
    name: 'code',
    in: 'query',
    required: false,
    description:
      'The OAuth authorization code, present on a successful grant — exchanged for an access token used once and discarded.',
    schema: { type: 'string' },
  },
  {
    name: 'state',
    in: 'query',
    required: false,
    description:
      'The signed state minted by the authorize redirect, verified before anything else runs — see modules/cloudflare/domain/state.ts.',
    schema: { type: 'string' },
  },
  {
    name: 'error',
    in: 'query',
    required: false,
    description:
      'Cloudflare’s OAuth error code, present when the domain owner declines the consent screen.',
    schema: { type: 'string' },
  },
]

function notConfigured() {
  return {
    body: apiError(
      'not_configured',
      'Cloudflare one-click DNS setup is not configured.',
    ),
    status: 404 as const,
  }
}

function invalidState() {
  return {
    body: apiError('invalid_request', 'Invalid or expired state.'),
    status: 400 as const,
  }
}

/** Where the callback sends the browser back to, `outcome` telling the hosted page which result to render next to the manual fallback instructions. */
function hostedRedirectUrl(
  frontendToken: string,
  outcome: CloudflareCallbackOutcome,
): string {
  return `${VERIFICATION_BASE_URL}/${frontendToken}?cloudflare=${outcome}`
}

/**
 * The Cloudflare one-click DNS setup flow's callback, mounted at
 * `/cloudflare` under `apis/frontend/router.ts` (giving
 * `/frontend/cloudflare/callback`) — deliberately not nested under
 * `/verifications/:token` the way the authorize route is
 * (`routes/verifications.ts`'s `GET /:token/cloudflare/authorize`): a
 * redirect_uri registered on an OAuth client is a fixed, exact-match URL,
 * so this route can't carry the claim's token in its own path. The signed
 * `state` round-tripped through Cloudflare's own redirect carries that
 * binding instead — see `modules/cloudflare/domain/state.ts`.
 *
 * Always redirects back to the hosted verification page with a
 * `?cloudflare=<outcome>` query param once `state` itself is trustworthy
 * — even on failure (denied, no matching zone, a failed record write) —
 * so the page can render an honest result next to the manual instructions.
 * Only an untrustworthy `state` (missing, expired, tampered) has no safe
 * redirect target and gets a plain `400` instead (see
 * `CloudflareOAuthService.handleCallback`'s doc comment).
 */
export function createCloudflareRoutes(
  cloudflareOAuthService: CloudflareOAuthService | undefined,
) {
  const router = new Hono()

  router.get(
    '/callback',
    describeRoute({
      tags: ['Verifications'],
      summary: 'Cloudflare one-click DNS setup OAuth callback',
      description:
        'Verifies state, exchanges the code, finds the matching zone, creates the TXT record, and triggers the standard verify path, then redirects to the hosted verification page with ?cloudflare=<outcome> (success/denied/no_matching_zone/record_create_failed/exchange_failed/not_found). 404s (not_configured) when CLOUDFLARE_OAUTH_CLIENT_ID/CLOUDFLARE_OAUTH_CLIENT_SECRET aren’t set.',
      security: [],
      parameters: callbackQueryParameters,
      responses: {
        302: {
          description:
            'Redirect to the hosted verification page with ?cloudflare=<outcome>',
        },
        400: errorResponse(
          'Missing, expired, or tampered state — no safe redirect target',
        ),
        404: errorResponse(
          'Cloudflare one-click DNS setup is not configured in this environment',
        ),
      },
    }),
    async (c) => {
      if (!cloudflareOAuthService) {
        const { body, status } = notConfigured()
        return c.json(body, status)
      }

      const { code, state, error } = c.req.query()
      const result = await cloudflareOAuthService.handleCallback({
        code,
        state,
        error,
      })

      if (!result.ok) {
        const { body, status } = invalidState()
        return c.json(body, status)
      }

      return c.redirect(
        hostedRedirectUrl(result.frontendToken, result.outcome),
        302,
      )
    },
  )

  return router
}
