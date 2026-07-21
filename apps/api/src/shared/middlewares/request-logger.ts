import type { MiddlewareHandler } from 'hono'
import type { Logger } from '@shared/logger'

export interface RequestLoggerConfig {
  /** Clock source, injected for deterministic tests. Default `Date.now`. */
  now?: () => number
  /**
   * The logger this middleware writes to — always wired explicitly from
   * `app.ts` (see `infra/logging/logger.ts`); tests use `createFakeLogger`
   * from `@shared/testing/fake-logger`.
   */
  logger: Logger
}

const MAX_BODY_BYTES = 2048
const TRUNCATED_MARKER = '...[truncated]'
const REDACTED_VALUE = '[redacted]'

/**
 * Body field names that must never reach a log line, matched
 * case-insensitively against every object key at any depth of a
 * request/response body. `key` is `modules/keys/service.ts`'s
 * `CreateKeyResult.key` — the one-time full api key
 * (`dp_<mode>_<keyId>_<secret>`) returned by `POST /dashboard/keys` and
 * `POST /dashboard/keys/:keyId/rotate`, the one payload this api's own
 * routes actually return that contains a raw secret today.
 * `secret`/`secrethash`/`token`/`password` are defensive, shape-based
 * matches for anything with the same sensitivity a future route might
 * add. Authorization/cookie *headers* are redacted separately, via
 * `infra/logging/logger.ts`'s pino `redact.paths` config.
 */
const SENSITIVE_BODY_FIELDS = new Set([
  'key',
  'secret',
  'secrethash',
  'token',
  'password',
])

// Guards against a pathological/malicious payload, not a realistic shape
// any route in this api produces.
const MAX_REDACT_DEPTH = 10

function redactBody(value: unknown, depth: number): unknown {
  if (depth > MAX_REDACT_DEPTH) {
    return '[max depth exceeded]'
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactBody(item, depth + 1))
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [field, fieldValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[field] = SENSITIVE_BODY_FIELDS.has(field.toLowerCase())
        ? REDACTED_VALUE
        : redactBody(fieldValue, depth + 1)
    }
    return result
  }

  return value
}

/**
 * Sanitizes a raw request/response body for debug-level payload logging:
 * redacts any field named like a secret (see `SENSITIVE_BODY_FIELDS`),
 * then truncates the serialized result beyond ~2KB with a marker so one
 * oversized payload can't blow up log storage or a downstream log
 * processor. `undefined` for an empty body; a `'[non-json body omitted]'`
 * placeholder for a body that isn't valid JSON (every route in this api
 * is JSON-only, so this should only ever show up for a malformed
 * request, never a real response).
 */
export function sanitizeBodyForLogging(rawBody: string): unknown {
  if (!rawBody) {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return '[non-json body omitted]'
  }

  const redacted = redactBody(parsed, 0)
  const serialized = JSON.stringify(redacted)

  if (serialized.length <= MAX_BODY_BYTES) {
    return redacted
  }

  return `${serialized.slice(0, MAX_BODY_BYTES)}${TRUNCATED_MARKER}`
}

/** Converts a fetch `Headers` object into the plain object shape `infra/logging/logger.ts`'s pino `redact.paths` (`req.headers.authorization`, `req.headers.cookie`) expects to find. */
export function headersToPlainObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

/**
 * One structured line per request at `info` — method, path, status,
 * duration — mounted once at the root of `app.ts` ahead of both planes.
 * Logs `c.req.path` (never the full URL, which could carry an api key in
 * its query string) and never headers, cookies, or bodies at this level.
 *
 * At `debug`, additionally logs the request/response bodies (see
 * `sanitizeBodyForLogging`) and request headers (redacted by the logger's
 * own `redact.paths`) — gated behind `logger.isLevelEnabled('debug')` so
 * production (default `info`) never pays the cost of cloning and parsing
 * every body.
 */
export function createRequestLoggerMiddleware(
  config: RequestLoggerConfig,
): MiddlewareHandler {
  const now = config.now ?? Date.now
  const log = config.logger

  return async (c, next) => {
    const start = now()
    const debugEnabled = log.isLevelEnabled('debug')
    // Cloned so a downstream handler can still read the original body —
    // a fetch API Request/Response can only be consumed once.
    const requestBodyText = debugEnabled ? await c.req.raw.clone().text() : ''

    let status = 500
    let thrown: unknown

    try {
      await next()
      status = c.res.status
    } catch (err) {
      thrown = err
    }

    const durationMs = now() - start

    log.info(
      {
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: durationMs,
      },
      'request completed',
    )

    if (debugEnabled) {
      const responseBodyText = thrown ? '' : await c.res.clone().text()

      log.debug(
        {
          req: {
            method: c.req.method,
            path: c.req.path,
            headers: headersToPlainObject(c.req.raw.headers),
            body: sanitizeBodyForLogging(requestBodyText),
          },
          res: {
            status,
            body: sanitizeBodyForLogging(responseBodyText),
          },
        },
        'request payload',
      )
    }

    if (thrown) {
      throw thrown
    }
  }
}
