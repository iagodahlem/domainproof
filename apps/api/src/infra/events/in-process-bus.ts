import type {
  DomainEventMap,
  DomainEventSubscriber,
  DomainEventType,
  EventBus,
} from '@shared/events'
import type { Logger } from '@shared/logger'
import { noopLogger } from '@shared/logger'

/**
 * The `EventBus` port's in-process implementation: a `Map` of subscriber
 * lists, dispatched synchronously (awaited in registration order) from
 * `publish`. This is the piece a future queue-backed adapter (SQS,
 * pg-boss, ...) would replace — every publisher and subscriber only knows
 * about the `EventBus` interface in `shared/events.ts`, never this file.
 *
 * A subscriber's own error is logged and swallowed rather than rejecting
 * `publish` or aborting later subscribers: a broken email send must never
 * take down the request that triggered it (e.g. a domain verification
 * response), and one subscriber's failure must never stop the persistence
 * subscriber (or any other subscriber) for the same event from running.
 */
export function createInProcessEventBus(logger: Logger = noopLogger): EventBus {
  const subscribers = new Map<
    DomainEventType,
    DomainEventSubscriber<DomainEventType>[]
  >()

  return {
    subscribe(type, subscriber) {
      const existing = subscribers.get(type)
      if (existing) {
        existing.push(subscriber as DomainEventSubscriber<DomainEventType>)
        return
      }
      subscribers.set(type, [
        subscriber as DomainEventSubscriber<DomainEventType>,
      ])
    },

    async publish(type, payload) {
      const typeSubscribers = subscribers.get(type)
      if (!typeSubscribers) {
        return
      }

      for (const subscriber of typeSubscribers) {
        try {
          await subscriber(payload as DomainEventMap[DomainEventType])
        } catch (err) {
          logger.error({ err, type }, 'Event subscriber failed')
        }
      }
    },
  }
}
