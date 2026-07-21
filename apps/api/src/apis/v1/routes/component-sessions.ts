import { Hono } from 'hono'
import { z } from 'zod'
import { describeRoute, resolver } from 'hono-openapi'
import type { ApiKeyAuthVariables } from '../middlewares/api-key'
import type { ComponentSessionsService } from '@modules/component-sessions/service'
import { apiError } from '@shared/http-errors'
import {
  apiKeySecurity,
  apiKeyUnauthorizedResponse,
  errorResponse,
  rateLimitedResponse,
  toJsonSchema,
} from '@shared/openapi'

// Generous enough for a real-world external id (a uuid, a database primary
// key, a Stripe-style `cus_...` id) without inviting a caller to stuff
// unrelated data into it.
const MAX_EXTERNAL_ID_LENGTH = 255

const createSessionBodySchema = z.object({
  externalId: z.string().min(1).max(MAX_EXTERNAL_ID_LENGTH).optional(),
})

function invalidRequest(message: string) {
  return {
    body: apiError('invalid_request', message),
    status: 400 as const,
  }
}

const createSessionResponseDoc = z
  .object({
    sessionToken: z.string(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ ref: 'ComponentSession' })

/**
 * Public-API component-session minting, mounted at `/component-sessions`
 * under the v1 plane's router (giving `/v1/component-sessions`) — the
 * one backend touchpoint in the drop-in-component flow: a builder's
 * server mints a session here (with its own api key, same auth as every
 * other v1 route), hands the returned `sessionToken` to its frontend
 * component, and the component spends it exactly once against
 * `POST /frontend/component-sessions/:sessionToken/claim` — never seeing
 * the api key itself. `projectId`/`mode` come from the authenticated key,
 * same as every other v1 route; there is no way for the request body to
 * override them.
 */
export function createComponentSessionsRoutes(
  componentSessionsService: ComponentSessionsService,
) {
  const router = new Hono<{ Variables: ApiKeyAuthVariables }>()

  router.post(
    '/',
    describeRoute({
      tags: ['Component Sessions'],
      summary: 'Mint a component session',
      description:
        'Mints a short-lived, single-use session token for a drop-in component to claim one domain on the caller’s behalf, without handing the component the api key itself.',
      security: apiKeySecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: toJsonSchema(createSessionBodySchema),
          },
        },
      },
      responses: {
        201: {
          description: 'The minted session',
          content: {
            'application/json': { schema: resolver(createSessionResponseDoc) },
          },
        },
        400: errorResponse('Invalid request body'),
        401: apiKeyUnauthorizedResponse,
        429: rateLimitedResponse,
      },
    }),
    async (c) => {
      const json = await c.req.json().catch(() => undefined)
      const parsed = createSessionBodySchema.safeParse(json ?? {})

      if (!parsed.success) {
        const { body, status } = invalidRequest('Invalid request body')
        return c.json(body, status)
      }

      const result = await componentSessionsService.createSession({
        projectId: c.get('projectId'),
        mode: c.get('mode'),
        externalId: parsed.data.externalId,
      })

      return c.json(
        {
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt,
        },
        201,
      )
    },
  )

  return router
}
