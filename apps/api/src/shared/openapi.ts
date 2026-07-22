import { z } from 'zod'
import { resolver } from 'hono-openapi'
import type { ResponsesWithResolver } from 'hono-openapi'
import type { OpenAPIV3_1 } from 'openapi-types'

type ResponseWithResolver = ResponsesWithResolver[string]

/**
 * Mirrors `http-errors.ts`'s `ApiErrorBody` — the one error shape every
 * non-2xx response on the documented planes uses. `.meta({ ref: ... })`
 * promotes this to a single named `components.schemas.ApiError`, reused via
 * `$ref` by every route's error responses instead of each one inlining its
 * own copy (see `resolver`'s ref-promotion behavior, used below).
 */
export const apiErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .meta({ ref: 'ApiError' })

/** An `application/json` OpenAPI response entry for the shared `{ error: { code, message } }` shape. */
export function errorResponse(description: string): ResponseWithResolver {
  return {
    description,
    content: {
      'application/json': {
        schema: resolver(apiErrorResponseSchema),
      },
    },
  }
}

/** Every `/v1/*` route requires this — see `apis/v1/middlewares/api-key.ts`. */
export const apiKeyUnauthorizedResponse = errorResponse(
  'Missing or invalid API key',
)

/**
 * Every rate-limited route (all of `/v1/*`, plus the Frontend API's `check`
 * and `claim` routes) can return this — see `shared/middlewares/rate-limit.ts`.
 */
export const rateLimitedResponse = errorResponse('Too many requests')

/** The `/v1/*` plane's auth scheme — see `components.securitySchemes.ApiKeyAuth` in `openapi.ts`. */
export const apiKeySecurity: OpenAPIV3_1.SecurityRequirementObject[] = [
  { ApiKeyAuth: [] },
]

/**
 * Converts a Zod schema into a plain JSON Schema object via Zod 4's native
 * `z.toJSONSchema` — used for `requestBody`/`parameters` positions in
 * `describeRoute(...)` specs, which (unlike `responses`) aren't run through
 * `hono-openapi`'s `resolver()` resolution pass, so a `resolver()` object
 * placed there would leak into the spec unresolved. Strips the top-level
 * `$schema` key, which OpenAPI 3.1 doesn't expect on each individual schema
 * object.
 */
export function toJsonSchema(schema: z.ZodType): OpenAPIV3_1.SchemaObject {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
  delete jsonSchema.$schema
  return jsonSchema as OpenAPIV3_1.SchemaObject
}

/**
 * Builds an OpenAPI `parameters` array (`in: "query"` or `in: "path"`) from
 * the exact same Zod object schema a route already uses to
 * `.safeParse(c.req.query())`/`c.req.param(...)` — the request-side
 * counterpart to `errorResponse`'s reuse of one shared schema: one object
 * definition drives both runtime validation and the documented parameter
 * list, so the two can't drift apart. Path parameters are always marked
 * required (Hono never matches a route without them); query parameters
 * follow the schema's own `required` list (i.e. whichever fields aren't
 * `.optional()`).
 */
export function toParameters(
  schema: z.ZodObject,
  location: 'query' | 'path',
): OpenAPIV3_1.ParameterObject[] {
  const jsonSchema = toJsonSchema(schema) as {
    properties?: Record<string, OpenAPIV3_1.SchemaObject>
    required?: string[]
  }
  const required = new Set(jsonSchema.required ?? [])

  return Object.entries(jsonSchema.properties ?? {}).map(
    ([name, propSchema]) =>
      ({
        name,
        in: location,
        required: location === 'path' ? true : required.has(name),
        // `openapi-types` aliases `OpenAPIV3_1.ParameterObject` straight to
        // `OpenAPIV3.ParameterObject` (see its `index.d.ts`), whose `schema`
        // field is typed against the 3.0 `SchemaObject` shape — stricter
        // than 3.1's JSON-Schema-based one `toJsonSchema` actually returns.
        // `hono-openapi`'s own `generateParameters` hits the same mismatch
        // and casts past it the same way.
        schema: propSchema as OpenAPIV3_1.ParameterObject['schema'],
      }) satisfies OpenAPIV3_1.ParameterObject,
  )
}
