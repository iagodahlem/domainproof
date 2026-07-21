/**
 * Test/live separation, same convention as `modeEnum` in `infra/db/schema.ts`
 * — defined here rather than imported from a module's repository so this
 * file stays decoupled from any one module's persistence types.
 */
export type Mode = 'test' | 'live'

/**
 * The fields shared by every event that's scoped to a claimed domain.
 * `domain` (the hostname, not just its id) is carried on the payload itself
 * so a subscriber (e.g. the email notifier) never needs to re-fetch the
 * domain just to say its name.
 */
interface DomainEventPayload {
  domainId: string
  projectId: string
  mode: Mode
  domain: string
}

/**
 * Every event this api can publish, keyed by its namespaced type, mapped to
 * its payload shape. Namespacing (`<subject>.<thing_that_happened>`) keeps
 * the flat string space collision-free as more producers show up.
 *
 * Adding a new event: add the entry here, publish it from wherever the
 * fact becomes true (see `modules/accounts/service.ts` and
 * `modules/domains/service.ts`), and subscribe to it in `app.ts`.
 */
export interface DomainEventMap {
  /** An account (and its default project) was bootstrapped for a Clerk user. */
  'account.created': {
    accountId: string
    clerkUserId: string
    /** `null` when neither the session claims nor the email resolver produced one — see `modules/accounts/ports.ts`. */
    email: string | null
  }
  /** A project claimed a domain and got a fresh verification challenge. */
  'domain.claimed': DomainEventPayload
  /** A domain's challenge was regenerated (a fresh token issued), restarting verification. */
  'domain.challenge_regenerated': DomainEventPayload
  /** A verification attempt's DNS check found the expected record. */
  'domain.check_passed': DomainEventPayload
  /** A verification attempt's DNS check did not find the expected record (or the attempt window expired). */
  'domain.check_failed': DomainEventPayload & { outcome: string }
  /** The domain transitioned to `verified` (first pass, or recovery from the grace window). */
  'domain.verified': DomainEventPayload
  /** A previously verified domain lost its record and entered the 72h grace window. */
  'domain.temporarily_failed': DomainEventPayload
  /** The domain transitioned to `failed` (verification window elapsed, or the grace window expired). */
  'domain.failed': DomainEventPayload
}

export type DomainEventType = keyof DomainEventMap

/** Every event type this api knows about, for wiring generic (type-agnostic) subscribers like event persistence — see `app.ts`. */
export const DOMAIN_EVENT_TYPES: DomainEventType[] = [
  'account.created',
  'domain.claimed',
  'domain.challenge_regenerated',
  'domain.check_passed',
  'domain.check_failed',
  'domain.verified',
  'domain.temporarily_failed',
  'domain.failed',
]

export type DomainEventSubscriber<T extends DomainEventType> = (
  payload: DomainEventMap[T],
) => void | Promise<void>

/**
 * The seam between "a state transition happened" and "everything that
 * reacts to it" — every domain status change (and account bootstrap)
 * publishes here, and the events-table timeline, the Resend email
 * notifier, and any future subscriber (webhooks, analytics, ...) all read
 * from the same bus instead of the publisher calling each of them by hand.
 *
 * Deliberately shaped so the in-process implementation
 * (`infra/events/in-process-bus.ts`) can be swapped for a real queue (SQS,
 * pg-boss, ...) later without touching a single publisher or subscriber:
 * both only ever depend on this interface, constructed once in `app.ts`.
 * A queue-backed adapter would change `publish` to enqueue instead of
 * dispatching inline, and `subscribe` to register a consumer instead of an
 * in-memory callback — same shape, different infra file.
 */
export interface EventBus {
  publish<T extends DomainEventType>(
    type: T,
    payload: DomainEventMap[T],
  ): Promise<void>
  subscribe<T extends DomainEventType>(
    type: T,
    subscriber: DomainEventSubscriber<T>,
  ): void
}
