import type { Logger } from '@shared/logger'

export type FakeLoggerLevel = 'debug' | 'info' | 'warn' | 'error'

export interface FakeLoggerCall {
  level: FakeLoggerLevel
  fields: Record<string, unknown>
  message?: string
}

export interface FakeLoggerOptions {
  /**
   * Backs `isLevelEnabled` — defaults to always-enabled, which is right for
   * the common case of a test that only cares about what got logged, not
   * about level gating. Pass e.g. `(level) => level !== 'debug'` for a test
   * exercising a caller's own `isLevelEnabled('debug')` branch (see
   * `shared/middlewares/request-logger.ts`).
   */
  isLevelEnabled?: (level: string) => boolean
}

export interface FakeLogger extends Logger {
  /** Every call made through this fake, in order, across all four levels. */
  calls: FakeLoggerCall[]
}

/**
 * The one `Logger` test double this repo's tests construct — implements the
 * port in memory and records every call (level, fields, message) instead of
 * writing anywhere, so a test can assert on `.calls` (optionally filtered by
 * `level`) without a real pino instance. Replaces the ad-hoc per-test
 * `fakeLogger()` helpers this consolidates (`infra/events/in-process-bus.test.ts`,
 * `modules/notifications/service.test.tsx`, `shared/middlewares/request-logger.test.ts`).
 */
export function createFakeLogger(options: FakeLoggerOptions = {}): FakeLogger {
  const calls: FakeLoggerCall[] = []
  const isLevelEnabled = options.isLevelEnabled ?? (() => true)

  function record(level: FakeLoggerLevel) {
    return (fields: Record<string, unknown>, message?: string) => {
      calls.push({ level, fields, message })
    }
  }

  return {
    calls,
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    isLevelEnabled,
  }
}
