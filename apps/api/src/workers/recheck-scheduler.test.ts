import { describe, expect, it, vi } from 'vitest'
import type {
  DomainsService,
  RecheckBatchResult,
} from '@modules/domains/service'
import { createFakeLogger } from '@shared/testing/fake-logger'
import { createRecheckScheduler } from './recheck-scheduler'

/**
 * A fake `DomainsService` stubbing only the two methods the scheduler
 * calls — every other method throws if the scheduler ever calls it
 * unexpectedly, since this file tests the scheduler's own tick/overlap/log
 * behavior, not `modules/domains`' logic (that's `service.test.ts`).
 */
function fakeDomainsService(
  overrides: Partial<
    Pick<DomainsService, 'recheckDueDomains' | 'expireOverdueGraceWindows'>
  > = {},
): DomainsService & {
  recheckCalls: Array<{ now: Date; limit: number }>
  expiryCalls: Array<{ now: Date; limit: number }>
} {
  const recheckCalls: Array<{ now: Date; limit: number }> = []
  const expiryCalls: Array<{ now: Date; limit: number }> = []
  const notUsed = (name: string) => () => {
    throw new Error(`${name} should not be called by the scheduler`)
  }

  return {
    recheckCalls,
    expiryCalls,
    claimDomain: notUsed('claimDomain'),
    listDomains: notUsed('listDomains'),
    getDomain: notUsed('getDomain'),
    releaseDomain: notUsed('releaseDomain'),
    verifyDomain: notUsed('verifyDomain'),
    async recheckDueDomains(now, limit): Promise<RecheckBatchResult> {
      recheckCalls.push({ now, limit })
      return overrides.recheckDueDomains
        ? overrides.recheckDueDomains(now, limit)
        : { processed: 0, errors: [] }
    },
    async expireOverdueGraceWindows(now, limit): Promise<RecheckBatchResult> {
      expiryCalls.push({ now, limit })
      return overrides.expireOverdueGraceWindows
        ? overrides.expireOverdueGraceWindows(now, limit)
        : { processed: 0, errors: [] }
    },
  }
}

describe('createRecheckScheduler', () => {
  it('tick() runs both batches with the configured batch size', async () => {
    const domainsService = fakeDomainsService()
    const scheduler = createRecheckScheduler({
      domainsService,
      batchSize: 7,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      logger: createFakeLogger(),
    })

    await scheduler.tick()

    expect(domainsService.recheckCalls).toEqual([
      { now: new Date('2026-01-01T00:00:00.000Z'), limit: 7 },
    ])
    expect(domainsService.expiryCalls).toEqual([
      { now: new Date('2026-01-01T00:00:00.000Z'), limit: 7 },
    ])
  })

  it('logs a summary line with processed/error counts from both batches', async () => {
    const domainsService = fakeDomainsService({
      recheckDueDomains: async () => ({
        processed: 3,
        errors: [{ domainId: 'a', message: 'boom' }],
      }),
      expireOverdueGraceWindows: async () => ({ processed: 1, errors: [] }),
    })
    const logger = createFakeLogger()
    const scheduler = createRecheckScheduler({ domainsService, logger })

    await scheduler.tick()

    const infoCalls = logger.calls.filter((call) => call.level === 'info')
    expect(infoCalls).toHaveLength(1)
    expect(infoCalls[0]?.message).toBe('recheck tick completed')
    expect(infoCalls[0]?.fields).toMatchObject({
      rechecked: 3,
      recheckErrors: 1,
      expired: 1,
      expiredErrors: 0,
    })
  })

  it('never overlaps ticks: a tick still in flight is skipped, not queued', async () => {
    let resolveFirstRecheck: (() => void) | undefined
    const domainsService = fakeDomainsService({
      recheckDueDomains: () =>
        new Promise((resolve) => {
          resolveFirstRecheck = () => resolve({ processed: 0, errors: [] })
        }),
    })
    const logger = createFakeLogger()
    const scheduler = createRecheckScheduler({ domainsService, logger })

    const firstTick = scheduler.tick()
    const secondTick = scheduler.tick()

    expect(domainsService.recheckCalls).toHaveLength(1)
    expect(
      logger.calls.some((call) =>
        call.message?.includes('previous tick still in flight'),
      ),
    ).toBe(true)

    resolveFirstRecheck?.()
    await firstTick
    await secondTick

    expect(domainsService.recheckCalls).toHaveLength(1)
  })

  it('logs and swallows an error from the service rather than throwing', async () => {
    const domainsService = fakeDomainsService({
      recheckDueDomains: async () => {
        throw new Error('db unavailable')
      },
    })
    const logger = createFakeLogger()
    const scheduler = createRecheckScheduler({ domainsService, logger })

    await expect(scheduler.tick()).resolves.toBeUndefined()
    const errorCalls = logger.calls.filter((call) => call.level === 'error')
    expect(errorCalls).toHaveLength(1)
    expect(errorCalls[0]?.message).toBe('recheck tick failed')
    expect((errorCalls[0]?.fields.err as Error).message).toBe(
      'db unavailable',
    )
  })

  it('a tick that failed clears the in-flight guard so the next tick can run', async () => {
    let shouldThrow = true
    const domainsService = fakeDomainsService({
      recheckDueDomains: async () => {
        if (shouldThrow) {
          shouldThrow = false
          throw new Error('transient')
        }
        return { processed: 0, errors: [] }
      },
    })
    const scheduler = createRecheckScheduler({
      domainsService,
      logger: createFakeLogger(),
    })

    await scheduler.tick()
    await scheduler.tick()

    expect(domainsService.recheckCalls).toHaveLength(2)
  })

  describe('start/stop', () => {
    it('start() runs a tick on each interval and stop() cancels it', async () => {
      vi.useFakeTimers()
      try {
        const domainsService = fakeDomainsService()
        const scheduler = createRecheckScheduler({
          domainsService,
          intervalMs: 1_000,
          logger: createFakeLogger(),
        })

        scheduler.start()
        expect(domainsService.recheckCalls).toHaveLength(0)

        // The async variant flushes each tick's promise chain between timer
        // firings — the plain sync `advanceTimersByTime` would race the
        // in-flight guard against ticks whose promises haven't settled yet.
        await vi.advanceTimersByTimeAsync(1_000)
        expect(domainsService.recheckCalls).toHaveLength(1)

        await vi.advanceTimersByTimeAsync(2_000)
        expect(domainsService.recheckCalls).toHaveLength(3)

        scheduler.stop()
        await vi.advanceTimersByTimeAsync(5_000)
        expect(domainsService.recheckCalls).toHaveLength(3)
      } finally {
        vi.useRealTimers()
      }
    })

    it('start() is idempotent — calling it twice does not double the interval', async () => {
      vi.useFakeTimers()
      try {
        const domainsService = fakeDomainsService()
        const scheduler = createRecheckScheduler({
          domainsService,
          intervalMs: 1_000,
          logger: createFakeLogger(),
        })

        scheduler.start()
        scheduler.start()
        await vi.advanceTimersByTimeAsync(1_000)

        expect(domainsService.recheckCalls).toHaveLength(1)
        scheduler.stop()
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
