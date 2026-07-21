export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * The injected boundary for sending a transactional email. A module-owned
 * port (same reasoning as `modules/accounts/ports.ts`'s `SessionVerifier`):
 * "send this rendered email" is specific to how this api notifies
 * builders, not a domain-wide concept like `DnsResolver`/`HttpFetcher`.
 *
 * The concrete implementation (the `resend` SDK) lives in
 * `apps/api/src/infra/email/resend.ts` — this module never imports the
 * vendor SDK directly. Must never throw: a delivery failure is logged and
 * swallowed by the adapter, matching the `EventBus`'s own "a subscriber's
 * failure never crashes the request path" contract (see
 * `infra/events/in-process-bus.ts`) — sending an email is a side effect of
 * an event, not something its publisher should ever wait to fail on.
 */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>
}
