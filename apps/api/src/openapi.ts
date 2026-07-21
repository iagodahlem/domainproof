import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Hono } from 'hono'
import { openAPIRouteHandler } from 'hono-openapi'
import { z } from 'zod'
import type { OpenAPIV3_1 } from 'openapi-types'
import { WEBHOOK_EVENT_TYPES } from '@modules/webhooks/domain/event-types'
import {
  WEBHOOK_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from '@modules/webhooks/domain/signing'
import { toJsonSchema } from '@shared/openapi'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface PackageJson {
  version: string
}

// Matches app.ts's identical read — this file's version needs to be
// available before `createApp`/`createServices` have built anything this
// module could otherwise borrow it from.
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as PackageJson

/**
 * Mirrors `shared/events.ts`'s `DomainEventPayload` — documentation only
 * (nothing here is parsed against a real delivery), kept next to the
 * webhook envelope it's part of so the two are easy to compare by eye.
 */
const domainEventPayloadDoc = z.object({
  domainId: z.string(),
  projectId: z.string(),
  mode: z.enum(['test', 'live']),
  domain: z.string(),
  externalId: z.string().nullable(),
})

/** Mirrors `shared/events.ts`'s `DomainEventMap['domain.check_failed']`. */
const checkFailedPayloadDoc = domainEventPayloadDoc.extend({
  outcome: z.string(),
})

const WEBHOOK_PAYLOAD_DOCS: Record<string, z.ZodType> = {
  'domain.check_failed': checkFailedPayloadDoc,
}

/** The `{ id, type, created_at, data }` envelope every webhook delivery's body follows — see README.md's Webhooks section. */
function webhookEnvelope(type: string, dataSchema: z.ZodType) {
  return z.object({
    id: z.string(),
    type: z.literal(type),
    created_at: z.iso.datetime(),
    data: dataSchema,
  })
}

/** The three headers every webhook delivery carries — see `modules/webhooks/domain/signing.ts`. */
const webhookHeaderParameters: OpenAPIV3_1.ParameterObject[] = [
  {
    name: WEBHOOK_ID_HEADER,
    in: 'header',
    required: true,
    description:
      'The delivery’s id — stable across retries of the same delivery, so a receiver can dedupe.',
    schema: { type: 'string' },
  },
  {
    name: WEBHOOK_TIMESTAMP_HEADER,
    in: 'header',
    required: true,
    description: 'Unix seconds at send time.',
    schema: { type: 'string' },
  },
  {
    name: WEBHOOK_SIGNATURE_HEADER,
    in: 'header',
    required: true,
    description:
      '`sha256=<hex hmac>` over `"<timestamp>.<raw body>"`, signed with the endpoint’s signing secret — see README.md’s Webhooks section for how to verify it.',
    schema: { type: 'string' },
  },
]

/**
 * The `webhooks` section of the generated document: one entry per
 * `WEBHOOK_EVENT_TYPES` (every project-scoped `DomainEventMap` event —
 * everything except `account.created`, which isn't project-scoped and so
 * can never be delivered), describing the outbound `POST` a project's
 * registered endpoint receives. This documents deliveries DomainProof makes
 * to a builder's own server, not an endpoint this api answers itself — see
 * `modules/webhooks/service.ts`'s dispatcher.
 */
/** `domain.temporarily_failed` -> `domainTemporarilyFailedWebhook`. */
function webhookOperationId(type: string): string {
  const camel = type
    .split(/[._]/)
    .map((part, i) =>
      i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join('')
  return `${camel}Webhook`
}

function buildWebhooks(): OpenAPIV3_1.Document['webhooks'] {
  const webhooks = Object.fromEntries(
    WEBHOOK_EVENT_TYPES.map((type) => [
      type,
      {
        post: {
          operationId: webhookOperationId(type),
          tags: ['Webhooks'],
          summary: `${type} delivery`,
          // No formal security scheme: this is an outbound delivery
          // DomainProof makes to a project's own endpoint, authenticated by
          // the receiver verifying the HMAC signature header below — not a
          // request the receiver authenticates itself against.
          security: [],
          parameters: webhookHeaderParameters,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: toJsonSchema(
                  webhookEnvelope(
                    type,
                    WEBHOOK_PAYLOAD_DOCS[type] ?? domainEventPayloadDoc,
                  ),
                ),
              },
            },
          },
          responses: {
            200: { description: 'Delivery acknowledged' },
          },
        },
      },
    ]),
  )

  // `openapi-types` aliases several OpenAPIV3_1 request/response types
  // straight to their OpenAPIV3 (3.0) counterparts (see `toParameters`'s
  // identical note in `shared/openapi.ts`), which don't structurally accept
  // the JSON-Schema-shaped values `toJsonSchema`/`webhookHeaderParameters`
  // actually produce. The object above is valid OpenAPI 3.1; only the
  // upstream type is too strict.
  return webhooks as OpenAPIV3_1.Document['webhooks']
}

const documentation: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: {
    title: 'DomainProof API',
    version: pkg.version,
    description:
      'Domain-ownership verification as an API-first product. Covers the Public API (`/v1/*`, API-key-authenticated) and the Frontend API (`/frontend/*`, token-in-path-authenticated) — the two planes meant for callers outside DomainProof’s own dashboard. See README.md for the full picture, including the session-authenticated Dashboard API this document deliberately omits.',
    license: {
      name: 'MIT',
      url: 'https://github.com/iagodahlem/domainproof/blob/main/LICENSE',
    },
  },
  servers: [
    {
      url: 'https://api.domainproof.dev',
      description: 'Production — /v1/* only',
    },
    {
      url: 'https://verify.domainproof.dev',
      description: 'Production — /frontend/* only',
    },
    {
      url: 'http://localhost:3001',
      description: 'Local development — every plane on one origin',
    },
  ],
  tags: [
    { name: 'Domains', description: 'Claim, verify, and manage domains.' },
    {
      name: 'Component Sessions',
      description:
        'Short-lived, single-use tokens that let a drop-in component claim a domain without an api key of its own.',
    },
    {
      name: 'Verifications',
      description:
        'Token-scoped read and bounded re-check access to one domain claim — what the hosted verification page calls.',
    },
    {
      name: 'Webhooks',
      description:
        'Outbound deliveries DomainProof sends to a project’s registered endpoints as a domain claim’s status changes.',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'dp_<mode>_<keyId>_<secret>',
        description:
          'A project API key, `dp_test_...` or `dp_live_...` — see `apis/v1/middlewares/api-key.ts`.',
      },
    },
  },
  webhooks: buildWebhooks(),
}

/**
 * Builds the `GET /v1/openapi.json` handler: a self-updating, request-time-
 * cached document (see `hono-openapi`'s `openAPIRouteHandler`) covering
 * every route registered on `app` at the moment the endpoint is first hit —
 * by which point `createApp` has already mounted every plane, so this only
 * needs the `app` reference itself, not a fully-built one. `/dashboard/*`
 * (the session-authenticated, internal-only plane) and `/health` (outside
 * every plane) are excluded — this document is the public v1 + Frontend API
 * surface only, the same scope `README.md`'s endpoints table covers minus
 * the Dashboard rows.
 */
export function createOpenApiRouteHandler(app: Hono) {
  return openAPIRouteHandler(app, {
    documentation,
    exclude: [/^\/dashboard(\/|$)/, '/health', '/v1/openapi.json'],
  })
}
