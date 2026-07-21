import type { MiddlewareHandler } from 'hono'
import {
  createRateLimitMiddleware,
  type RateLimitVariables,
} from '@shared/middlewares/rate-limit'

/**
 * The claim route's abuse guard, bucketed per session token — the same
 * adapter pattern as `token-rate-limit.ts`'s check-route limiter. A
 * session is single-use by construction (see
 * `ComponentSessionsRepository.consumeIfAvailable`), so this isn't
 * guarding against repeated *successful* claims — it's here to bound how
 * many attempts (validation failures, a mistyped domain, guesses at an
 * unknown token) a single token can generate. Generous — a component
 * retrying after a typo shouldn't get blocked — not tuned for a bot.
 */
const CLAIM_LIMIT = 10
const CLAIM_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Adapts the `:sessionToken` route param into the `keyId` bucket key
 * `createRateLimitMiddleware` expects — identical in spirit to
 * `token-rate-limit.ts`'s `createTokenKeyMiddleware`, just for this
 * plane's other token-shaped path param.
 */
function createSessionTokenKeyMiddleware(): MiddlewareHandler<{
  Variables: RateLimitVariables
}> {
  return async (c, next) => {
    // A generic (non-path-bound) middleware can't get Hono's literal
    // path-param typing, so `c.req.param('sessionToken')` is typed as
    // `string | undefined` here even though the route it's mounted on
    // always has a `:sessionToken` segment — the `?? ''` is a type-only
    // fallback.
    c.set('keyId', c.req.param('sessionToken') ?? '')
    await next()
  }
}

export interface ClaimRateLimitConfig {
  /** Clock source, injected for deterministic tests. Default `Date.now`. */
  now?: () => number
}

/**
 * A fixed-length tuple, not `MiddlewareHandler[]` — see
 * `token-rate-limit.ts`'s identical doc comment for why spreading a plain
 * array here would defeat Hono's overload resolution for the trailing
 * handler.
 */
type ClaimRateLimitMiddlewares = [
  MiddlewareHandler<{ Variables: RateLimitVariables }>,
  MiddlewareHandler<{ Variables: RateLimitVariables }>,
]

export function createClaimRateLimitMiddlewares(
  config: ClaimRateLimitConfig = {},
): ClaimRateLimitMiddlewares {
  return [
    createSessionTokenKeyMiddleware(),
    createRateLimitMiddleware({
      limit: CLAIM_LIMIT,
      windowMs: CLAIM_WINDOW_MS,
      now: config.now,
    }),
  ]
}
