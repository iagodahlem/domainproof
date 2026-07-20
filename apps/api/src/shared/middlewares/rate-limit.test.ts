import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import {
  createRateLimitMiddleware,
  type RateLimitVariables,
} from './rate-limit'

/**
 * Builds a minimal app that stands in for the real pipeline: a fake
 * "auth" step that sets `keyId` from a header (so tests can address
 * different keys), the rate limiter under test, and a trivial handler.
 * Only sets `keyId` — this middleware is plane-agnostic and doesn't care
 * what else a real plane's auth middleware would set.
 */
function buildApp(config: Parameters<typeof createRateLimitMiddleware>[0]) {
  const app = new Hono<{ Variables: RateLimitVariables }>()

  app.use('*', async (c, next) => {
    c.set('keyId', c.req.header('x-test-key-id') ?? 'key_1')
    await next()
  })

  app.get('/ping', createRateLimitMiddleware(config), (c) =>
    c.json({ ok: true }),
  )

  return app
}

async function requestAs(
  app: Hono<{ Variables: RateLimitVariables }>,
  keyId: string,
) {
  return app.request('/ping', { headers: { 'x-test-key-id': keyId } })
}

describe('createRateLimitMiddleware', () => {
  it('allows the 100th request and rejects the 101st within the window', async () => {
    const currentTime = 0
    const app = buildApp({
      limit: 100,
      windowMs: 60_000,
      now: () => currentTime,
    })

    for (let i = 0; i < 100; i++) {
      const res = await requestAs(app, 'key_a')
      expect(res.status).toBe(200)
    }

    const res = await requestAs(app, 'key_a')
    expect(res.status).toBe(429)

    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('rate_limited')
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('tracks separate budgets per key id', async () => {
    const currentTime = 0
    const app = buildApp({ limit: 1, windowMs: 60_000, now: () => currentTime })

    const first = await requestAs(app, 'key_a')
    expect(first.status).toBe(200)

    // A different key's budget is untouched by key_a's usage.
    const otherKey = await requestAs(app, 'key_b')
    expect(otherKey.status).toBe(200)

    const secondForA = await requestAs(app, 'key_a')
    expect(secondForA.status).toBe(429)
  })

  it('slides the window: requests age out and free up budget', async () => {
    let currentTime = 0
    const app = buildApp({ limit: 2, windowMs: 1000, now: () => currentTime })

    expect((await requestAs(app, 'key_a')).status).toBe(200)
    currentTime = 500
    expect((await requestAs(app, 'key_a')).status).toBe(200)

    // Budget of 2 exhausted within the window.
    currentTime = 900
    expect((await requestAs(app, 'key_a')).status).toBe(429)

    // The first request (t=0) ages out once we're past t=1000; the
    // second (t=500) is still within the window, so only one new slot
    // frees up.
    currentTime = 1001
    expect((await requestAs(app, 'key_a')).status).toBe(200)
    expect((await requestAs(app, 'key_a')).status).toBe(429)
  })

  it('computes Retry-After from the oldest request still in the window', async () => {
    let currentTime = 0
    const app = buildApp({ limit: 1, windowMs: 10_000, now: () => currentTime })

    expect((await requestAs(app, 'key_a')).status).toBe(200)

    currentTime = 3_000
    const res = await requestAs(app, 'key_a')
    expect(res.status).toBe(429)
    // Window frees up at t=10_000; from t=3_000 that's 7 seconds away.
    expect(res.headers.get('Retry-After')).toBe('7')
  })
})
