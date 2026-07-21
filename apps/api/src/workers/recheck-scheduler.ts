import type { DomainsService } from '@modules/domains/service'
import type { Logger } from '@shared/logger'

export interface RecheckSchedulerConfig {
  /**
   * The scheduler is a second driver of `modules/domains`, alongside the
   * `/v1/domains/:id/verify` route — timer-triggered instead of
   * request-triggered, otherwise the same relationship: it depends on the
   * module's service type directly, same as a route file would (see
   * `apis/v1/routes/domains.ts`). It lives in `workers/` rather than
   * `infra/` or `apis/` because it's neither an adapter implementing a
   * module-owned port nor an HTTP route — see ARCHITECTURE.md.
   */
  domainsService: DomainsService
  /** How often a tick runs. Default 60s — see `env.ts`'s `RECHECK_INTERVAL_MS`. */
  intervalMs?: number
  /** How many domains each of a tick's two batches (recheck, grace-expiry) processes at most. Default 10. */
  batchSize?: number
  /** Clock, injected for deterministic tests. Default `() => new Date()`. */
  now?: () => Date
  /**
   * Composition-root dependency (see `index.ts`), same as every other
   * module/worker — the real instance is a `createChildLogger({ module:
   * 'recheck-scheduler' })`; tests use `createFakeLogger` from
   * `@shared/testing/fake-logger`.
   */
  logger: Logger
}

export interface RecheckScheduler {
  start(): void
  stop(): void
  /** Runs one tick directly — used by tests instead of waiting on the interval timer. */
  tick(): Promise<void>
}

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_BATCH_SIZE = 10

/**
 * The background re-check worker's driver: a `setInterval` loop that, each
 * tick, asks `modules/domains` for every domain due a re-check (pending
 * backoff, verified continuous re-check, temporarily_failed grace-window
 * re-check) and every `temporarily_failed` domain whose 72h grace window
 * has expired, and runs the corresponding batch. Never overlaps ticks — a
 * tick still in flight when the timer fires again is skipped outright
 * rather than queued, so a slow batch (or a stalled db) can't pile up
 * concurrent ticks against the same domains.
 */
export function createRecheckScheduler(
  config: RecheckSchedulerConfig,
): RecheckScheduler {
  const { domainsService, logger } = config
  const intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE
  const now = config.now ?? (() => new Date())

  let timer: ReturnType<typeof setInterval> | undefined
  let ticking = false

  async function tick(): Promise<void> {
    if (ticking) {
      logger.info({}, 'recheck tick skipped: previous tick still in flight')
      return
    }
    ticking = true

    try {
      const startedAt = Date.now()
      const tickNow = now()
      const recheck = await domainsService.recheckDueDomains(tickNow, batchSize)
      const expiry = await domainsService.expireOverdueGraceWindows(
        tickNow,
        batchSize,
      )

      logger.info(
        {
          rechecked: recheck.processed,
          recheckErrors: recheck.errors.length,
          expired: expiry.processed,
          expiredErrors: expiry.errors.length,
          durationMs: Date.now() - startedAt,
        },
        'recheck tick completed',
      )
    } catch (err) {
      logger.error({ err }, 'recheck tick failed')
    } finally {
      ticking = false
    }
  }

  return {
    start() {
      if (timer) {
        return
      }
      timer = setInterval(() => {
        void tick()
      }, intervalMs)
      // Never keeps the process alive on its own — a clean shutdown (or a
      // test that never calls stop()) doesn't have to wait out the
      // interval.
      timer.unref()
    },

    stop() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
    },

    tick,
  }
}
