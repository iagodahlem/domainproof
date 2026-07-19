/**
 * Failure reasons an {@link HttpFetcher} can report for a well-known-file
 * fetch. Kept as a closed set of string codes (rather than thrown errors) so
 * callers can switch on them exhaustively, mirroring {@link
 * TxtResolutionFailureReason} in resolver.ts.
 *
 * - `timeout` — the request didn't complete in time.
 * - `connection_failed` — the connection couldn't be established, the host
 *   couldn't be resolved, the response wasn't parseable as HTTP, or the
 *   response was a redirect this fetcher refuses to follow (see the
 *   same-host/HTTPS note on {@link HttpFetcher} below).
 * - `tls_error` — the TLS handshake failed (expired/untrusted/mismatched
 *   certificate, protocol negotiation failure, etc).
 * - `too_large` — the response body exceeded the size cap before or while
 *   being read.
 */
export type HttpFetchFailureReason =
  | "timeout"
  | "connection_failed"
  | "tls_error"
  | "too_large";

/**
 * Result of fetching a single URL's body as text. Mirrors the shape of
 * {@link TxtResolution}: success carries the data callers need (status +
 * body), failure carries a closed-set reason instead of an exception.
 */
export type HttpFetchResult =
  | { ok: true; status: number; body: string }
  | { ok: false; reason: HttpFetchFailureReason };

/**
 * The maximum response body size a fetcher will hand back, in bytes. The
 * well-known challenge file is expected to be a handful of short lines (one
 * per pending verification) — 64KB is generous headroom for that while still
 * capping how much of a possibly-huge or misconfigured response a check has
 * to buffer in memory.
 */
export const MAX_FETCH_BODY_BYTES = 64 * 1024;

/**
 * The injected HTTP boundary for the well-known-file verification method —
 * the sibling of {@link DnsResolver} for the HTTP check. This is the only
 * place raw network IO is allowed to happen from for this method; everything
 * above it (the check function, the state machine, API routes) depends on
 * this interface, never on a concrete fetcher. That separation is what makes
 * the verification flow demoable and testable without hitting real network
 * endpoints.
 *
 * Implementations must never throw. Every failure mode — a timed-out
 * connection, a TLS error, a body that's too big to safely buffer — is
 * represented as a value in {@link HttpFetchResult}, not as a rejected
 * promise. A fetcher that throws breaks every caller's exhaustive handling
 * of the `ok: false` case.
 *
 * Implementations must enforce two additional contracts beyond "don't
 * throw":
 *
 * - **Size cap.** The body is truncated/rejected above {@link
 *   MAX_FETCH_BODY_BYTES} — the challenge file is tiny by design, so a
 *   response far past that size is either a misconfiguration or an attempt
 *   to make the checker buffer something expensive, and should fail fast as
 *   `too_large` rather than being read in full.
 * - **Redirect confinement.** Implementations follow redirects ONLY when the
 *   target is the same host and uses HTTPS, and only up to 3 hops. A
 *   redirect to a *different* host would let site A "prove" ownership of its
 *   domain using a file that actually lives on site B — the redirect target
 *   is attacker-controlled the moment DNS or the server for the original
 *   domain is compromised or misconfigured, so it can never be trusted to
 *   vouch for a domain other than the one being checked. A cross-host or
 *   non-HTTPS redirect is reported as `{ ok: false, reason:
 *   "connection_failed" }` rather than being followed.
 */
export interface HttpFetcher {
  fetchText(url: string): Promise<HttpFetchResult>;
}
