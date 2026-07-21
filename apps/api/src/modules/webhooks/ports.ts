export interface WebhookDeliveryRequest {
  url: string
  /** The already-serialized JSON body — signed and sent byte-for-byte as given, never re-serialized by the sender. */
  body: string
  headers: Record<string, string>
}

export interface WebhookDeliveryResult {
  /** `true` for a 2xx response; `false` for any other status, a timeout, or a network/TLS failure. */
  ok: boolean
  /** The response status code, when a response was received at all (absent on timeout/network failure). */
  status?: number
  /** A short, loggable description of what went wrong — never the raw thrown error. */
  error?: string
}

/**
 * The injected boundary for delivering one signed webhook POST. A module-
 * owned port (same reasoning as `modules/notifications/ports.ts`'s
 * `EmailSender`): "POST this delivery to an integrator's endpoint" is
 * specific to how this api dispatches webhooks, not a domain-wide concept
 * like `DnsResolver`/`HttpFetcher`.
 *
 * The concrete implementation (`fetch`) lives in
 * `apps/api/src/infra/http/webhook-sender.ts` — this module never calls
 * `fetch` directly. Must never throw: a delivery failure (timeout,
 * connection refused, non-2xx status, ...) is always a `{ ok: false, ... }`
 * result, never a thrown error — `service.ts`'s retry loop depends on that
 * to decide whether to schedule another attempt.
 */
export interface WebhookSender {
  send(request: WebhookDeliveryRequest): Promise<WebhookDeliveryResult>
}
