import { Agent } from 'undici'
import type {
  WebhookDeliveryResult,
  WebhookSender,
} from '@modules/webhooks/ports'
import type { ResolveAllFn } from './ssrf-guard'
import { createVettedLookup } from './ssrf-guard'

/** Default request timeout, in milliseconds, before a delivery attempt is aborted and treated as a failure (eligible for retry). */
const DEFAULT_TIMEOUT_MS = 10_000

/** The subset of the `fetch` signature this sender depends on. */
type FetchLike = (input: string, init: RequestInit) => Promise<Response>

/**
 * Node's `fetch` (undici) accepts a non-standard `dispatcher` field on
 * `RequestInit` to route a request through a specific dispatcher. Typed as
 * `unknown` and bridged with a cast at the call site rather than declared
 * on an interface extending `RequestInit`: depending on the `@types/node`
 * version in scope, the DOM lib's `RequestInit` may or may not already
 * declare its own `dispatcher` field (sourced from the separate
 * `undici-types` package `@types/node` bundles), and that shape doesn't
 * structurally match the standalone `undici` package's own `Dispatcher`
 * type one-for-one — extending `RequestInit` with a conflicting
 * declaration fails to typecheck. Runtime behavior is unaffected either
 * way; only the two `.d.ts` sources disagree.
 */
type FetchInitWithDispatcher = Record<string, unknown>

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
  /** Overrides the real DNS lookup `./ssrf-guard.ts`'s `createVettedLookup` uses — test-only, production callers never pass this. */
  resolveAll?: ResolveAllFn
}

/**
 * Production {@link WebhookSender} over Node 22's built-in `fetch` — the
 * sibling of `infra/http/node-fetch.ts`'s `HttpFetcher` implementation for
 * the well-known-file check, but simpler: a webhook delivery is a single
 * POST with no body-size accounting to do (the body is our own signed
 * JSON, not an untrusted response we're reading). It does still need
 * `HttpFetcher`'s sibling protection against connecting somewhere internal
 * — see `./ssrf-guard.ts` — since `apis/dashboard/routes/webhooks.ts` only
 * validates that the endpoint URL is *shaped* like a URL, never where it
 * resolves.
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
      // A fresh dispatcher per delivery attempt: `connect.lookup`
      // re-resolves and re-vets every connection it opens, including the
      // connection made to a redirect's target host (a distinct origin
      // gets its own connection) — see `./ssrf-guard.ts`'s
      // `createVettedLookup` doc comment.
      const dispatcher = new Agent({
        connect: { lookup: createVettedLookup(options.resolveAll) },
      })
      const init: FetchInitWithDispatcher = {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
        dispatcher,
      }

      try {
        const response = await fetchImpl(url, init as unknown as RequestInit)
        const ok = response.status >= 200 && response.status < 300
        return { ok, status: response.status }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return { ok: false, error: `Timed out after ${timeoutMs}ms` }
        }
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, error: message }
      } finally {
        await dispatcher.close().catch(() => undefined)
        clearTimeout(timer)
      }
    },
  }
}
