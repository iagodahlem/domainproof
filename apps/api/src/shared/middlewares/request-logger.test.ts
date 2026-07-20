import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createRequestLoggerMiddleware } from './request-logger'

function buildApp(lines: string[]) {
  const app = new Hono()

  app.use(
    '*',
    createRequestLoggerMiddleware({
      now: () => 0,
      log: (line) => lines.push(line),
    }),
  )

  app.get('/ping', (c) => c.json({ ok: true }))
  app.get('/boom', () => {
    throw new Error('boom')
  })
  app.onError((_err, c) => c.json({ error: 'internal_error' }, 500))

  return app
}

describe('createRequestLoggerMiddleware', () => {
  it('logs method, path, status, and duration for a successful request', async () => {
    const lines: string[] = []
    const app = buildApp(lines)

    const res = await app.request('/ping?api_key=dp_live_secret')

    expect(res.status).toBe(200)
    expect(lines).toEqual(['method=GET path=/ping status=200 duration_ms=0'])
  })

  it('logs status 500 and rethrows when a handler throws', async () => {
    const lines: string[] = []
    const app = buildApp(lines)

    const res = await app.request('/boom')

    expect(res.status).toBe(500)
    expect(lines).toEqual(['method=GET path=/boom status=500 duration_ms=0'])
  })
})
