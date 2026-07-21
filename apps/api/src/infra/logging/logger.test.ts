import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { createLogger } from './logger'

/** Captures every line a pino logger writes, parsed back from JSON, instead of writing to real stdout. */
function collector() {
  const lines: Record<string, unknown>[] = []
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>)
      callback()
    },
  })
  return { stream, lines }
}

describe('createLogger', () => {
  it('only emits lines at or above the configured level', () => {
    const { stream, lines } = collector()
    const logger = createLogger({ level: 'info' }, stream)

    logger.debug({}, 'should not appear')
    logger.info({}, 'should appear')

    expect(lines).toHaveLength(1)
    expect(lines[0]?.msg).toBe('should appear')
  })

  it('isLevelEnabled reflects the configured level', () => {
    const { stream } = collector()

    expect(
      createLogger({ level: 'debug' }, stream).isLevelEnabled('debug'),
    ).toBe(true)
    expect(
      createLogger({ level: 'info' }, stream).isLevelEnabled('debug'),
    ).toBe(false)
  })

  it('redacts req.headers.authorization and req.headers.cookie in the serialized output', () => {
    const { stream, lines } = collector()
    const logger = createLogger({ level: 'debug' }, stream)

    logger.debug(
      {
        req: {
          headers: {
            authorization: 'Bearer session-token',
            cookie: 'sid=abc123',
            'content-type': 'application/json',
          },
        },
      },
      'request payload',
    )

    const req = lines[0]?.req as { headers: Record<string, string> }
    expect(req.headers.authorization).toBe('[redacted]')
    expect(req.headers.cookie).toBe('[redacted]')
    expect(req.headers['content-type']).toBe('application/json')

    // The raw secret must never appear anywhere in the serialized line.
    expect(JSON.stringify(lines[0])).not.toContain('session-token')
    expect(JSON.stringify(lines[0])).not.toContain('sid=abc123')
  })

  it('serializes an error under `err` via the standard pino error serializer', () => {
    const { stream, lines } = collector()
    const logger = createLogger({ level: 'info' }, stream)

    logger.error({ err: new Error('boom') }, 'Unhandled error')

    const err = lines[0]?.err as { message: string; stack: string }
    expect(err.message).toBe('boom')
    expect(typeof err.stack).toBe('string')
  })

  it('a child logger inherits the parent level and redact config', () => {
    const { stream, lines } = collector()
    const logger = createLogger({ level: 'warn' }, stream)
    const child = logger.child({ module: 'accounts' })

    child.info({}, 'should not appear')
    child.warn(
      { req: { headers: { authorization: 'Bearer x' } } },
      'should appear',
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]?.module).toBe('accounts')
    const req = lines[0]?.req as { headers: Record<string, string> }
    expect(req.headers.authorization).toBe('[redacted]')
  })
})
