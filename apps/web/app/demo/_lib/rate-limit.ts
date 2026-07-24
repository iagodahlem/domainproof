interface Bucket {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitOptions {
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

/** Fixed-window limiter, in-memory — enough to stop casual abuse of a public demo without a Redis dependency. `key` should namespace by route (`scan:1.2.3.4`) so one endpoint's traffic can't burn another's budget. */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterMs: windowMs - (now - bucket.windowStart),
    }
  }

  bucket.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

/** Test-only: clears every bucket between test cases. */
export function resetRateLimitForTests(): void {
  buckets.clear()
}
