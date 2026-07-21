import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { RateLimitVariables } from '@shared/middlewares/rate-limit'
import { createCheckRateLimitMiddlewares } from './token-rate-limit'

/**
 * Stands in for how `routes/verifications.ts` mounts the chain on
 * `POST /:token/check` — a trivial handler is enough to test the
 * middleware chain itself in isolation, at the same granularity
 * `shared/middlewares/rate-limit.test.ts` uses for the underlying
 * limiter.
 */
function buildApp(now: () => number) {
  const app = new Hono<{ Variables: RateLimitVariables }>()
  app.post(
    '/verifications/:token/check',
    ...createCheckRateLimitMiddlewares({ now }),
    (c) => c.json({ ok: true }),
  )
  return app
}

async function checkAs(app: ReturnType<typeof buildApp>, token: string) {
  return app.request(`/verifications/${token}/check`, { method: 'POST' })
}

describe('createCheckRateLimitMiddlewares', () => {
  it('blocks a second check on the same token within 15 seconds', async () => {
    let currentTime = 0
    const app = buildApp(() => currentTime)

    expect((await checkAs(app, 'token-a')).status).toBe(200)
    currentTime = 14_000
    const second = await checkAs(app, 'token-a')
    expect(second.status).toBe(429)
    const body = (await second.json()) as { error: { code: string } }
    expect(body.error.code).toBe('rate_limited')
  })

  it('allows a check again once 15 seconds have passed', async () => {
    let currentTime = 0
    const app = buildApp(() => currentTime)

    expect((await checkAs(app, 'token-a')).status).toBe(200)
    currentTime = 15_000
    expect((await checkAs(app, 'token-a')).status).toBe(200)
  })

  it('tracks separate budgets per token', async () => {
    const currentTime = 0
    const app = buildApp(() => currentTime)

    expect((await checkAs(app, 'token-a')).status).toBe(200)
    // A different token's budget is untouched by token-a's usage, even at
    // the exact same instant.
    expect((await checkAs(app, 'token-b')).status).toBe(200)
  })

  it('caps at 20 checks per hour even when each is 15+ seconds apart', async () => {
    let currentTime = 0
    const app = buildApp(() => currentTime)

    for (let i = 0; i < 20; i++) {
      const res = await checkAs(app, 'token-a')
      expect(res.status).toBe(200)
      currentTime += 15_000
    }

    // Still comfortably inside the hour (20 * 15s = 5 minutes elapsed) and
    // past the 15s cooldown, but the hourly cap is now exhausted.
    const blocked = await checkAs(app, 'token-a')
    expect(blocked.status).toBe(429)
  })

  it('frees up hourly budget once an hour has fully elapsed', async () => {
    let currentTime = 0
    const app = buildApp(() => currentTime)

    for (let i = 0; i < 20; i++) {
      await checkAs(app, 'token-a')
      currentTime += 15_000
    }
    expect((await checkAs(app, 'token-a')).status).toBe(429)

    currentTime += 60 * 60 * 1000
    expect((await checkAs(app, 'token-a')).status).toBe(200)
  })
})
