import { describe, expect, it, vi } from 'vitest'
import { createFakeLogger } from '@shared/testing/fake-logger'
import { createInProcessEventBus } from './in-process-bus'

describe('createInProcessEventBus', () => {
  it('delivers a published event to every subscriber of that type', async () => {
    const bus = createInProcessEventBus(createFakeLogger())
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
    const bus = createInProcessEventBus(createFakeLogger())
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
    const bus = createInProcessEventBus(createFakeLogger())
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
    const logger = createFakeLogger()
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
    const errorCalls = logger.calls.filter((call) => call.level === 'error')
    expect(errorCalls).toHaveLength(1)
    expect(errorCalls[0]?.fields.type).toBe('domain.failed')
  })

  it('is a no-op when nothing is subscribed to a published type', async () => {
    const bus = createInProcessEventBus(createFakeLogger())
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
