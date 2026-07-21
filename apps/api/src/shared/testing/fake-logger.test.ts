import { describe, expect, it } from 'vitest'
import { createFakeLogger } from './fake-logger'

describe('createFakeLogger', () => {
  it('records a call to each level, in order, with its fields and message', () => {
    const logger = createFakeLogger()

    logger.debug({ a: 1 }, 'debug msg')
    logger.info({ b: 2 }, 'info msg')
    logger.warn({ c: 3 }, 'warn msg')
    logger.error({ d: 4 }, 'error msg')

    expect(logger.calls).toEqual([
      { level: 'debug', fields: { a: 1 }, message: 'debug msg' },
      { level: 'info', fields: { b: 2 }, message: 'info msg' },
      { level: 'warn', fields: { c: 3 }, message: 'warn msg' },
      { level: 'error', fields: { d: 4 }, message: 'error msg' },
    ])
  })

  it('records a call made without a message', () => {
    const logger = createFakeLogger()

    logger.info({ a: 1 })

    expect(logger.calls).toEqual([
      { level: 'info', fields: { a: 1 }, message: undefined },
    ])
  })

  it('defaults isLevelEnabled to always true', () => {
    const logger = createFakeLogger()

    expect(logger.isLevelEnabled('debug')).toBe(true)
    expect(logger.isLevelEnabled('trace')).toBe(true)
  })

  it('backs isLevelEnabled with the given predicate', () => {
    const logger = createFakeLogger({
      isLevelEnabled: (level) => level !== 'debug',
    })

    expect(logger.isLevelEnabled('debug')).toBe(false)
    expect(logger.isLevelEnabled('info')).toBe(true)
  })
})
