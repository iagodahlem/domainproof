import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { Logger } from '@shared/logger'
import { createFakeLogger, type FakeLogger } from '@shared/testing/fake-logger'
import {
  createRequestLoggerMiddleware,
  headersToPlainObject,
  sanitizeBodyForLogging,
} from './request-logger'

/** A fake `Logger` whose `isLevelEnabled('debug')` reflects `debugEnabled` — this middleware's own debug-gating is exactly what several tests below exercise. */
function fakeLogger(debugEnabled: boolean): FakeLogger {
  return createFakeLogger({
    isLevelEnabled: (level) => (level === 'debug' ? debugEnabled : true),
  })
}

function buildApp(logger: Logger) {
  const app = new Hono()

  app.use('*', createRequestLoggerMiddleware({ now: () => 0, logger }))

  app.get('/ping', (c) => c.json({ ok: true }))
  app.post('/keys', async (c) => {
    const body = await c.req.json()
    return c.json({ key: 'dp_live_abc123_supersecret', apiKey: body }, 201)
  })
  app.get('/boom', () => {
    throw new Error('boom')
  })
  app.onError((_err, c) => c.json({ error: 'internal_error' }, 500))

  return app
}

describe('createRequestLoggerMiddleware', () => {
  it('logs method, path, status, and duration at info for a successful request', async () => {
    const logger = fakeLogger(false)
    const app = buildApp(logger)

    const res = await app.request('/ping?api_key=dp_live_secret')

    expect(res.status).toBe(200)
    expect(logger.calls).toEqual([
      {
        level: 'info',
        fields: { method: 'GET', path: '/ping', status: 200, duration_ms: 0 },
        message: 'request completed',
      },
    ])
  })

  it('logs status 500 at info and rethrows when a handler throws', async () => {
    const logger = fakeLogger(false)
    const app = buildApp(logger)

    const res = await app.request('/boom')

    expect(res.status).toBe(500)
    expect(logger.calls).toEqual([
      {
        level: 'info',
        fields: { method: 'GET', path: '/boom', status: 500, duration_ms: 0 },
        message: 'request completed',
      },
    ])
  })

  it('never reads or logs a body when debug is disabled', async () => {
    const logger = fakeLogger(false)
    const app = buildApp(logger)

    await app.request('/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'live' }),
    })

    expect(logger.calls.map((c) => c.level)).toEqual(['info'])
  })

  it('logs redacted request/response bodies at debug', async () => {
    const logger = fakeLogger(true)
    const app = buildApp(logger)

    await app.request('/keys', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer session-token',
      },
      body: JSON.stringify({ mode: 'live', name: 'ci' }),
    })

    const debugCall = logger.calls.find((c) => c.level === 'debug')
    expect(debugCall).toBeDefined()
    const { req, res } = debugCall!.fields as {
      req: { headers: Record<string, string>; body: unknown }
      res: { status: number; body: unknown }
    }

    // Headers are passed through as a plain object; redaction of
    // authorization/cookie is the logger's own job (infra/logging/logger.ts's
    // pino `redact.paths`), not this middleware's — so the raw value is
    // still present here, unredacted.
    expect(req.headers.authorization).toBe('Bearer session-token')
    expect(req.body).toEqual({ mode: 'live', name: 'ci' })

    // The response's `key` field (the one-time api key secret) must never
    // appear in the clear, regardless of pino's own header-only redaction.
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      key: '[redacted]',
      apiKey: { mode: 'live', name: 'ci' },
    })
  })
})

describe('sanitizeBodyForLogging', () => {
  it('returns undefined for an empty body', () => {
    expect(sanitizeBodyForLogging('')).toBeUndefined()
  })

  it('returns a placeholder for a non-JSON body', () => {
    expect(sanitizeBodyForLogging('not json')).toBe('[non-json body omitted]')
  })

  it('redacts sensitive fields at arbitrary nesting depth', () => {
    const body = JSON.stringify({
      apiKey: { key: 'dp_live_x_y', nested: { secret: 'shh', token: 't' } },
      password: 'hunter2',
      safe: 'value',
    })

    expect(sanitizeBodyForLogging(body)).toEqual({
      apiKey: {
        key: '[redacted]',
        nested: { secret: '[redacted]', token: '[redacted]' },
      },
      password: '[redacted]',
      safe: 'value',
    })
  })

  it('redacts sensitive fields inside arrays', () => {
    const body = JSON.stringify({
      apiKeys: [{ key: 'dp_live_a' }, { key: 'dp_live_b' }],
    })

    expect(sanitizeBodyForLogging(body)).toEqual({
      apiKeys: [{ key: '[redacted]' }, { key: '[redacted]' }],
    })
  })

  it('truncates a payload beyond ~2KB with a marker', () => {
    const body = JSON.stringify({ value: 'x'.repeat(3000) })

    const result = sanitizeBodyForLogging(body)

    expect(typeof result).toBe('string')
    expect((result as string).endsWith('...[truncated]')).toBe(true)
    expect((result as string).length).toBeLessThan(body.length)
  })

  it('does not truncate a payload at or under ~2KB', () => {
    const body = JSON.stringify({ value: 'x'.repeat(100) })

    expect(sanitizeBodyForLogging(body)).toEqual({ value: 'x'.repeat(100) })
  })
})

describe('headersToPlainObject', () => {
  it('converts a Headers object into a plain object', () => {
    const headers = new Headers({
      authorization: 'Bearer secret',
      'content-type': 'application/json',
    })

    expect(headersToPlainObject(headers)).toEqual({
      authorization: 'Bearer secret',
      'content-type': 'application/json',
    })
  })
})
