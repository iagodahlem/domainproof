import type { MiddlewareHandler } from "hono";
import type { ApiKeyAuthVariables } from "./api-key";

export interface RateLimitConfig {
  /** Max requests allowed per key within the window. Default 100. */
  limit?: number;
  /** Sliding window size in milliseconds. Default 60_000 (1 minute). */
  windowMs?: number;
  /** Clock source, injected for deterministic tests. Default `Date.now`. */
  now?: () => number;
}

/**
 * Per-API-key sliding-window rate limiter. Must be mounted downstream of
 * {@link createApiKeyAuthMiddleware} (it reads the `keyId` variable that
 * middleware sets).
 *
 * State lives in an in-memory `Map<keyId, timestamps[]>` — per-process
 * only. It resets on every deploy/restart, and a multi-instance
 * deployment gives each instance its own independent budget rather than
 * one shared budget across instances. That's an acceptable tradeoff for a
 * single-instance API; the production-grade fix is a shared store (e.g.
 * Redis sorted sets with `ZADD`/`ZREMRANGEBYSCORE` for a real sliding
 * window, or a token bucket) so the limit holds across processes.
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig = {},
): MiddlewareHandler<{ Variables: ApiKeyAuthVariables }> {
  const limit = config.limit ?? 100;
  const windowMs = config.windowMs ?? 60_000;
  const now = config.now ?? Date.now;

  const hits = new Map<string, number[]>();

  return async (c, next) => {
    const keyId = c.get("keyId");
    const currentTime = now();
    const windowStart = currentTime - windowMs;

    const recent = (hits.get(keyId) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (recent.length >= limit) {
      const oldest = recent[0] as number;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + windowMs - currentTime) / 1000),
      );
      c.header("Retry-After", String(retryAfterSeconds));
      return c.json(
        {
          error: { code: "rate_limited", message: "Too many requests" },
        },
        429,
      );
    }

    recent.push(currentTime);
    hits.set(keyId, recent);

    await next();
  };
}
