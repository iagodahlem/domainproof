import { DOMAIN_EVENT_TYPES, type DomainEventType } from '@shared/events'

/**
 * The event types a webhook endpoint can subscribe to: every
 * `DomainEventType` except `account.created`, which isn't project-scoped
 * (see `shared/events.ts`'s `DomainEventPayload` — it carries no
 * `projectId`) and so could never be routed to a project's endpoints.
 */
export type WebhookEventType = Exclude<DomainEventType, 'account.created'>

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] =
  DOMAIN_EVENT_TYPES.filter(
    (type): type is WebhookEventType => type !== 'account.created',
  )

export function isWebhookEventType(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as string[]).includes(value)
}
