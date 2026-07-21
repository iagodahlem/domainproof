import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { RateLimitVariables } from '@shared/middlewares/rate-limit'
import { createClaimRateLimitMiddlewares } from './component-session-rate-limit'

/**
 * Stands in for how `routes/component-sessions.ts` mounts the chain on
 * `POST /:sessionToken/claim` — a trivial handler is enough to test the
 * middleware chain itself in isolation, same granularity
 * `token-rate-limit.test.ts` uses for the check route's limiter.
 */
function buildApp(now: () => number) {
  const app = new Hono<{ Variables: RateLimitVariables }>()
  app.post(
    '/component-sessions/:sessionToken/claim',
    ...createClaimRateLimitMiddlewares({ now }),
    (c) => c.json({ ok: true }),
  )
  return app
}

async function claimAs(app: ReturnType<typeof buildApp>, token: string) {
  return app.request(`/component-sessions/${token}/claim`, {
    method: 'POST',
  })
}

describe('createClaimRateLimitMiddlewares', () => {
  it('allows up to 10 attempts on the same session token within an hour', async () => {
    let currentTime = 0
    const app = buildApp(() => currentTime)

    for (let i = 0; i < 10; i++) {
      const res = await claimAs(app, 'session-a')
      expect(res.status).toBe(200)
      currentTime += 1_000
    }
  })

  it('blocks the 11th attempt on the same token within the hour', async () => {
    let currentTime = 0
    const app = buildApp(() => currentTime)

    for (let i = 0; i < 10; i++) {
      await claimAs(app, 'session-a')
      currentTime += 1_000
    }

    const blocked = await claimAs(app, 'session-a')
    expect(blocked.status).toBe(429)
    const body = (await blocked.json()) as { error: { code: string } }
    expect(body.error.code).toBe('rate_limited')
  })

  it('tracks separate budgets per session token', async () => {
    const currentTime = 0
    const app = buildApp(() => currentTime)

    for (let i = 0; i < 10; i++) {
      await claimAs(app, 'session-a')
    }
    expect((await claimAs(app, 'session-a')).status).toBe(429)

    // A different token's budget is untouched by session-a's exhaustion.
    expect((await claimAs(app, 'session-b')).status).toBe(200)
  })

  it('frees up budget once an hour has fully elapsed', async () => {
    let currentTime = 0
    const app = buildApp(() => currentTime)

    for (let i = 0; i < 10; i++) {
      await claimAs(app, 'session-a')
      currentTime += 1_000
    }
    expect((await claimAs(app, 'session-a')).status).toBe(429)

    currentTime += 60 * 60 * 1000
    expect((await claimAs(app, 'session-a')).status).toBe(200)
  })
})
