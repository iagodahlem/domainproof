/**
 * The minimal logging port modules/apis code against — a narrow structural
 * subset of pino's `Logger`, satisfied by `infra/logging/logger.ts`'s pino
 * instance without any file outside `infra/` needing to import `pino`
 * itself. This keeps the concrete logging library an infra concern, same
 * as every other vendor behind a port (Resend, Clerk, node:dns) — see
 * ARCHITECTURE.md's dependency rules.
 */
export interface Logger {
  debug(obj: Record<string, unknown>, msg?: string): void
  info(obj: Record<string, unknown>, msg?: string): void
  warn(obj: Record<string, unknown>, msg?: string): void
  error(obj: Record<string, unknown>, msg?: string): void
  isLevelEnabled(level: string): boolean
}
