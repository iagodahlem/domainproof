import type { MiddlewareHandler } from 'hono'
import { apiError } from '@shared/http-errors'

/**
 * Configured hostnames for each API plane. All optional — absent means no
 * restriction for that plane (and if none are set, no restriction at all).
 * See "Route planes" in ARCHITECTURE.md.
 */
export interface HostRestrictionConfig {
  /** e.g. `api.domainproof.dev`. Restricts that host to `/v1/*`. */
  publicApiHost?: string
  /** e.g. `dashboard.api.domainproof.dev`. Restricts that host to `/dashboard/*`. */
  dashboardApiHost?: string
  /** e.g. `verify.domainproof.dev`. Restricts that host to `/frontend/*`. */
  frontendApiHost?: string
  /**
   * e.g. `mcp.domainproof.dev`. Restricts that host to `/mcp` — the
   * hosted MCP endpoint (`apis/mcp/router.ts`), not one of the three
   * authentication planes above, but confined to its own host the same
   * way for the same reason: a host serving the public/dashboard/frontend
   * planes has no business also answering MCP JSON-RPC traffic.
   */
  mcpHost?: string
}

const PUBLIC_PLANE_PREFIX = '/v1'
const DASHBOARD_PLANE_PREFIX = '/dashboard'
const FRONTEND_PLANE_PREFIX = '/frontend'
const MCP_PREFIX = '/mcp'

/**
 * Liveness check, exempt from host restriction on every host — see the
 * carve-out note below.
 */
const HEALTH_CHECK_PATH = '/health'

/**
 * Confines each configured plane hostname to its own path prefix. Mounted
 * once at the root of `app.ts`, ahead of every plane router — it decides
 * which plane (if any) a request is allowed to reach before any router's
 * own auth middleware runs.
 *
 * A request's `Host` header (port stripped, so `api.domainproof.dev:443`
 * and `api.domainproof.dev` behave the same) is checked against the
 * configured hostnames:
 *
 * - `/health` (exact path) always passes through, on every host — see
 *   the carve-out note below.
 * - Host matches `publicApiHost` and the path isn't under `/v1` -> 404.
 * - Host matches `dashboardApiHost` and the path isn't under `/dashboard` -> 404.
 * - Host matches `frontendApiHost` and the path isn't under `/frontend` -> 404.
 * - Host matches `mcpHost` and the path isn't `/mcp` -> 404.
 * - Everything else — an unconfigured plane, an unmatched host
 *   (`localhost`, `*.up.railway.app`), or none of the vars set at all —
 *   passes through untouched. Local dev, tests, and the Railway service
 *   domain never see this restriction; no `/etc/hosts` games required to
 *   exercise any plane.
 *
 * The rejection is a plain 404 through the shared `{ error: { code,
 * message } }` taxonomy — the same shape and status an unmatched route
 * gets, not a 403. A 403 would tell a caller "this route exists but you
 * can't have it," which confirms the other plane's routes exist on this
 * host at all. 404 says nothing lives here, indistinguishable from any
 * other wrong path.
 *
 * `/health` is a deliberate carve-out from "only that plane's routes
 * reach a restricted host": external uptime monitors hit
 * `api.domainproof.dev/health` directly, not just Railway's internal
 * healthcheck, so it needs to answer on every production hostname, not
 * only on hosts where it happens to fall inside the reachable plane.
 */
export function createHostRestrictionMiddleware(
  config: HostRestrictionConfig,
): MiddlewareHandler {
  const { publicApiHost, dashboardApiHost, frontendApiHost, mcpHost } = config

  return async (c, next) => {
    if (!publicApiHost && !dashboardApiHost && !frontendApiHost && !mcpHost) {
      await next()
      return
    }

    const path = c.req.path

    if (path === HEALTH_CHECK_PATH) {
      await next()
      return
    }

    const host = stripPort(c.req.header('host'))

    const wrongPlane =
      (host === publicApiHost && !path.startsWith(PUBLIC_PLANE_PREFIX)) ||
      (host === dashboardApiHost && !path.startsWith(DASHBOARD_PLANE_PREFIX)) ||
      (host === frontendApiHost && !path.startsWith(FRONTEND_PLANE_PREFIX)) ||
      (host === mcpHost && !path.startsWith(MCP_PREFIX))

    if (wrongPlane) {
      return c.json(apiError('not_found', 'Route not found'), 404)
    }

    await next()
  }
}

function stripPort(host: string | undefined): string {
  if (!host) return ''
  const colonIndex = host.indexOf(':')
  return colonIndex === -1 ? host : host.slice(0, colonIndex)
}
