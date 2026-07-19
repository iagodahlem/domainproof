import type { HttpFetcher, HttpFetchFailureReason, HttpFetchResult } from "../fetcher.js";
import { MAX_FETCH_BODY_BYTES } from "../fetcher.js";

/**
 * The only file in this package allowed to perform real network IO for the
 * HTTP well-known check — the sibling of a real DNS resolver implementation
 * for the TXT check. Everything above this module (the check function, the
 * state machine, API routes) depends on the {@link HttpFetcher} interface,
 * never on this concrete implementation.
 */

/** Default request timeout, in milliseconds, before a fetch is aborted. */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Maximum number of redirects followed before giving up. Each hop must
 * additionally be same-host and HTTPS (see {@link HttpFetcher}'s
 * redirect-confinement contract) — this cap bounds hops even when every one
 * of them individually satisfies that check, so a same-host redirect loop
 * can't hang a verification check indefinitely.
 */
const DEFAULT_MAX_REDIRECTS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** The subset of the `fetch` signature this fetcher depends on. */
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface NodeFetchFetcherOptions {
  /** Overrides {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Overrides {@link DEFAULT_MAX_REDIRECTS}. */
  maxRedirects?: number;
  /** Overrides {@link MAX_FETCH_BODY_BYTES}. */
  maxBodyBytes?: number;
  /**
   * The underlying fetch function to use. Defaults to `globalThis.fetch`
   * (Node's built-in fetch). Injectable so tests can exercise the
   * redirect/timeout/size-cap logic in this module without making real
   * network requests.
   */
  fetchImpl?: FetchLike;
}

/**
 * Error `cause.code` values (Node's `ERR_TLS_*` family and the OpenSSL
 * verification codes it wraps) that indicate the failure happened during
 * the TLS handshake or certificate validation, rather than at the TCP/DNS
 * level. Matched by prefix/substring since Node surfaces both its own
 * `ERR_TLS_*` codes and raw OpenSSL reason codes (`CERT_HAS_EXPIRED`,
 * `DEPTH_ZERO_SELF_SIGNED_CERT`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, ...)
 * depending on where in the handshake it failed.
 */
function isTlsErrorCode(code: string): boolean {
  return code.startsWith("ERR_TLS_") || code.startsWith("ERR_SSL_") || code.includes("CERT");
}

function classifyThrown(error: unknown): HttpFetchResult {
  if (error instanceof Error && error.name === "AbortError") {
    return { ok: false, reason: "timeout" };
  }

  const cause = error instanceof Error ? error.cause : undefined;
  const code =
    cause !== null && typeof cause === "object" && "code" in cause
      ? String((cause as { code: unknown }).code)
      : undefined;

  const reason: HttpFetchFailureReason =
    code !== undefined && isTlsErrorCode(code) ? "tls_error" : "connection_failed";

  return { ok: false, reason };
}

function parseUrlSafely(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/**
 * Resolves a redirect `Location` header against the URL it was returned
 * for, and confirms it's a same-host HTTPS target. Returns `undefined` for
 * anything else — an unparseable Location, a scheme change to `http:`, or a
 * different host — which callers treat as a refused redirect (see {@link
 * HttpFetcher}'s redirect-confinement contract for why cross-host redirects
 * are never followed).
 */
function resolveSameHostHttpsRedirect(location: string, from: URL, originalHost: string): URL | undefined {
  const target = parseUrlSafely(new URL(location, from).toString());
  if (target === undefined) {
    return undefined;
  }
  if (target.protocol !== "https:") {
    return undefined;
  }
  if (target.hostname.toLowerCase() !== originalHost) {
    return undefined;
  }
  return target;
}

/**
 * Production {@link HttpFetcher} over Node 22's built-in `fetch`. Enforces,
 * in order: a request timeout via `AbortController`, manual redirect
 * handling that only follows same-host HTTPS targets up to {@link
 * DEFAULT_MAX_REDIRECTS} hops, and a body size cap checked against both the
 * `content-length` header (fails fast, before reading) and the actual body
 * length (in case the header is absent, wrong, or the server streams more
 * than it declared).
 *
 * Never throws: every failure path (timeout, DNS/connection failure, TLS
 * failure, oversized body, refused redirect) is caught and mapped to an
 * {@link HttpFetchResult}.
 */
export function createNodeFetchFetcher(options: NodeFetchFetcherOptions = {}): HttpFetcher {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBodyBytes = options.maxBodyBytes ?? MAX_FETCH_BODY_BYTES;
  const fetchImpl: FetchLike = options.fetchImpl ?? (globalThis.fetch as FetchLike);

  async function fetchText(url: string): Promise<HttpFetchResult> {
    const originalUrl = parseUrlSafely(url);
    if (originalUrl === undefined) {
      return { ok: false, reason: "connection_failed" };
    }
    const originalHost = originalUrl.hostname.toLowerCase();

    let currentUrl = originalUrl;
    let redirectCount = 0;

    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(currentUrl.toString(), {
          redirect: "manual",
          signal: controller.signal,
        });
      } catch (error) {
        return classifyThrown(error);
      } finally {
        clearTimeout(timer);
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        if (location === null) {
          return { ok: false, reason: "connection_failed" };
        }
        if (redirectCount >= maxRedirects) {
          return { ok: false, reason: "connection_failed" };
        }
        const nextUrl = resolveSameHostHttpsRedirect(location, currentUrl, originalHost);
        if (nextUrl === undefined) {
          return { ok: false, reason: "connection_failed" };
        }
        currentUrl = nextUrl;
        redirectCount += 1;
        continue;
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength !== null) {
        const declaredLength = Number(contentLength);
        if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
          return { ok: false, reason: "too_large" };
        }
      }

      let body: string;
      try {
        body = await response.text();
      } catch (error) {
        return classifyThrown(error);
      }

      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        return { ok: false, reason: "too_large" };
      }

      return { ok: true, status: response.status, body };
    }
  }

  return { fetchText };
}
