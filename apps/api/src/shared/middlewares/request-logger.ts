import type { MiddlewareHandler } from 'hono'

export interface RequestLoggerConfig {
  /** Clock source, injected for deterministic tests. Default `Date.now`. */
  now?: () => number
  /** Log sink, injected for tests. Default `console.log`. */
  log?: (line: string) => void
}

/**
 * One structured line per request — method, path, status, duration —
 * mounted once at the root of `app.ts` ahead of both planes. Logs
 * `c.req.path` (never the full URL, which could carry an api key in its
 * query string) and never headers, cookies, or bodies.
 */
export function createRequestLoggerMiddleware(
  config: RequestLoggerConfig = {},
): MiddlewareHandler {
  const now = config.now ?? Date.now
  const log = config.log ?? console.log

  return async (c, next) => {
    const start = now()
    try {
      await next()
      log(line(c.req.method, c.req.path, c.res.status, now() - start))
    } catch (err) {
      log(line(c.req.method, c.req.path, 500, now() - start))
      throw err
    }
  }
}

function line(
  method: string,
  path: string,
  status: number,
  durationMs: number,
): string {
  return `method=${method} path=${path} status=${status} duration_ms=${durationMs}`
}
