import pino from 'pino'
import { env } from '../../env'

/**
 * Redacts the Authorization/Cookie headers wherever a logged object nests
 * a `headers` object at this exact path — today only
 * `shared/middlewares/request-logger.ts`'s debug-level payload log builds
 * an object shaped like this (`req.headers`), but declaring the paths here
 * means every future call site that logs headers gets the same guarantee
 * for free, rather than needing to remember to redact them itself.
 *
 * Request/response *bodies* are redacted separately, by
 * `shared/middlewares/request-logger.ts`'s own recursive
 * `sanitizeBodyForLogging` — bodies are arbitrary, caller-controlled JSON
 * of unknown depth, which fixed-depth pino paths can't reach the way a
 * recursive walk can.
 */
const REDACT_PATHS = ['req.headers.authorization', 'req.headers.cookie']

const REDACTED_CENSOR = '[redacted]'

export interface LoggerConfig {
  level: string
  /** Use the `pino-pretty` transport for human-readable output. Dev-only — production always writes plain JSON lines to stdout. */
  pretty?: boolean
}

/**
 * Builds a pino logger. Split out from the `logger` singleton below so
 * tests can construct one with an injected `destination` (capturing
 * output in-memory) instead of writing to real stdout — see
 * `logger.test.ts`.
 */
export function createLogger(
  config: LoggerConfig,
  destination?: NodeJS.WritableStream,
): pino.Logger {
  const options: pino.LoggerOptions = {
    level: config.level,
    redact: { paths: REDACT_PATHS, censor: REDACTED_CENSOR },
    serializers: { err: pino.stdSerializers.err },
  }

  if (destination) {
    return pino(options, destination)
  }

  if (config.pretty) {
    return pino(
      options,
      pino.transport({ target: 'pino-pretty', options: { colorize: true } }),
    )
  }

  return pino(options)
}

/**
 * The api's one root logger, wired into the composition root (`app.ts`)
 * and threaded into every collaborator that already logged via
 * `console.*` before this (see `infra/events/in-process-bus.ts`,
 * `infra/email/resend.ts`). Level defaults to `info` via `env.LOG_LEVEL`
 * (see `env.ts`); `pino-pretty` only applies in development, so
 * production always emits plain JSON.
 */
export const logger = createLogger({
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
})

/** A logger scoped with fixed bindings (e.g. a module name), merged onto every line it writes — inherits the root logger's level/redact/transport config. */
export function createChildLogger(
  bindings: Record<string, unknown>,
): pino.Logger {
  return logger.child(bindings)
}
