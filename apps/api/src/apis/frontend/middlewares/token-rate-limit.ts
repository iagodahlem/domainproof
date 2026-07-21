import type { MiddlewareHandler } from 'hono'
import {
  createRateLimitMiddleware,
  type RateLimitVariables,
} from '@shared/middlewares/rate-limit'

/**
 * The check route's abuse guard: a domain owner refreshing the hosted
 * verification page shouldn't be able to hammer DNS, but a single minute-
 * scale limit would either let a burst through or punish someone who
 * legitimately checks twice in a row right after fixing their record. Two
 * independent windows cover both: a short cooldown between individual
 * checks, and a generous cap on how many can happen in an hour. Numbers are
 * deliberately generous for an anxious human clicking "check again," not
 * tuned for a bot — see README.md's Frontend API section.
 */
const MIN_INTERVAL_MS = 15_000
const MIN_INTERVAL_LIMIT = 1
const HOURLY_LIMIT = 20
const HOURLY_WINDOW_MS = 60 * 60 * 1000

/**
 * Adapts the `:token` route param into the `keyId` bucket key
 * `createRateLimitMiddleware` expects — this plane rate-limits per
 * verification token, not per api key, but the shared middleware only ever
 * looks at `c.get('keyId')` (see its doc comment: plane-agnostic by
 * design), so no new rate-limit implementation is needed, only this
 * adapter.
 */
function createTokenKeyMiddleware(): MiddlewareHandler<{
  Variables: RateLimitVariables
}> {
  return async (c, next) => {
    // A generic (non-path-bound) middleware can't get Hono's literal
    // path-param typing, so `c.req.param('token')` is typed as
    // `string | undefined` here even though the route it's mounted on
    // always has a `:token` segment — the `?? ''` is a type-only fallback.
    c.set('keyId', c.req.param('token') ?? '')
    await next()
  }
}

export interface CheckRateLimitConfig {
  /** Clock source, injected for deterministic tests. Default `Date.now`. Shared by both windows below. */
  now?: () => number
}

/**
 * The full rate-limit chain for `POST /frontend/verifications/:token/check`:
 * bucket-by-token, then a 15s-minimum-interval limiter and an hourly-cap
 * limiter in series (each `createRateLimitMiddleware()` call owns its own
 * independent in-memory window — see its doc comment for the per-process
 * tradeoff, same as `apis/v1`'s per-key limiter). Only this one route is
 * limited; `GET` reads are cheap and unauthenticated-safe to poll freely.
 */
/**
 * A fixed-length tuple, not `MiddlewareHandler[]` — spreading a plain array
 * into `router.post(path, ...middlewares, handler)` (a rest parameter
 * followed by one more fixed argument) defeats Hono's overload resolution
 * for the trailing handler; a tuple's statically-known length doesn't.
 */
type CheckRateLimitMiddlewares = [
  MiddlewareHandler<{ Variables: RateLimitVariables }>,
  MiddlewareHandler<{ Variables: RateLimitVariables }>,
  MiddlewareHandler<{ Variables: RateLimitVariables }>,
]

export function createCheckRateLimitMiddlewares(
  config: CheckRateLimitConfig = {},
): CheckRateLimitMiddlewares {
  return [
    createTokenKeyMiddleware(),
    createRateLimitMiddleware({
      limit: MIN_INTERVAL_LIMIT,
      windowMs: MIN_INTERVAL_MS,
      now: config.now,
    }),
    createRateLimitMiddleware({
      limit: HOURLY_LIMIT,
      windowMs: HOURLY_WINDOW_MS,
      now: config.now,
    }),
  ]
}
