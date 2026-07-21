import type {
  WebhookDeliveryResult,
  WebhookSender,
} from '@modules/webhooks/ports'

/** Default request timeout, in milliseconds, before a delivery attempt is aborted and treated as a failure (eligible for retry). */
const DEFAULT_TIMEOUT_MS = 10_000

/** The subset of the `fetch` signature this sender depends on. */
type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export interface NodeFetchWebhookSenderOptions {
  /** Overrides {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number
  /**
   * The underlying fetch function to use. Defaults to `globalThis.fetch`.
   * Injectable so tests can exercise the timeout/error-mapping logic in
   * this module without making real network requests — production callers
   * (`app.ts`) never pass this.
   */
  fetchImpl?: FetchLike
}

/**
 * Production {@link WebhookSender} over Node 22's built-in `fetch` — the
 * sibling of `infra/http/node-fetch.ts`'s `HttpFetcher` implementation for
 * the well-known-file check, but simpler: a webhook delivery is a single
 * POST with no redirect-following or body-size accounting to do (the body
 * is our own signed JSON, not an untrusted response we're reading).
 *
 * Never throws, matching the `WebhookSender` port's contract: a timeout or
 * any other network/TLS failure is caught and mapped to
 * `{ ok: false, error }` rather than propagating, so `modules/webhooks`'
 * retry loop never has to distinguish "the sender threw" from "the sender
 * reported a failure".
 */
export function createNodeFetchWebhookSender(
  options: NodeFetchWebhookSenderOptions = {},
): WebhookSender {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl: FetchLike =
    options.fetchImpl ?? (globalThis.fetch as FetchLike)

  return {
    async send({ url, body, headers }): Promise<WebhookDeliveryResult> {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetchImpl(url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        })
        const ok = response.status >= 200 && response.status < 300
        return { ok, status: response.status }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return { ok: false, error: `Timed out after ${timeoutMs}ms` }
        }
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, error: message }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
