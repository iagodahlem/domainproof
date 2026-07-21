import { describe, expect, it, vi } from 'vitest'
import type { Logger } from '@shared/logger'
import { createInProcessEventBus } from './in-process-bus'

/** A fake `Logger` implementing the port in memory, recording every error call for assertions. */
function fakeLogger(): Logger & { errors: Record<string, unknown>[] } {
  const errors: Record<string, unknown>[] = []
  return {
    errors,
    debug() {},
    info() {},
    warn() {},
    error(obj) {
      errors.push(obj)
    },
    isLevelEnabled: () => true,
  }
}

describe('createInProcessEventBus', () => {
  it('delivers a published event to every subscriber of that type', async () => {
    const bus = createInProcessEventBus()
    const first = vi.fn()
    const second = vi.fn()

    bus.subscribe('domain.verified', first)
    bus.subscribe('domain.verified', second)

    const payload = {
      domainId: 'd1',
      projectId: 'p1',
      mode: 'live' as const,
      domain: 'example.com',
    }
    await bus.publish('domain.verified', payload)

    expect(first).toHaveBeenCalledWith(payload)
    expect(second).toHaveBeenCalledWith(payload)
  })

  it('never delivers a published event to a subscriber of a different type', async () => {
    const bus = createInProcessEventBus()
    const subscriber = vi.fn()

    bus.subscribe('domain.failed', subscriber)
    await bus.publish('domain.verified', {
      domainId: 'd1',
      projectId: 'p1',
      mode: 'live',
      domain: 'example.com',
    })

    expect(subscriber).not.toHaveBeenCalled()
  })

  it('runs subscribers in registration order and awaits each one', async () => {
    const bus = createInProcessEventBus()
    const calls: string[] = []

    bus.subscribe('account.created', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      calls.push('first')
    })
    bus.subscribe('account.created', () => {
      calls.push('second')
    })

    await bus.publish('account.created', {
      accountId: 'a1',
      clerkUserId: 'u1',
      email: null,
    })

    expect(calls).toEqual(['first', 'second'])
  })

  it('logs and continues past a subscriber that throws, without rejecting publish', async () => {
    const logger = fakeLogger()
    const bus = createInProcessEventBus(logger)
    const survivor = vi.fn()

    bus.subscribe('domain.failed', () => {
      throw new Error('boom')
    })
    bus.subscribe('domain.failed', survivor)

    await expect(
      bus.publish('domain.failed', {
        domainId: 'd1',
        projectId: 'p1',
        mode: 'live',
        domain: 'example.com',
      }),
    ).resolves.toBeUndefined()

    expect(survivor).toHaveBeenCalled()
    expect(logger.errors).toHaveLength(1)
    expect(logger.errors[0]?.type).toBe('domain.failed')
  })

  it('is a no-op when nothing is subscribed to a published type', async () => {
    const bus = createInProcessEventBus()
    await expect(
      bus.publish('domain.claimed', {
        domainId: 'd1',
        projectId: 'p1',
        mode: 'test',
        domain: 'example.com',
      }),
    ).resolves.toBeUndefined()
  })
})
