/**
 * Failure reasons a {@link DnsResolver} can report for a TXT lookup. Kept as
 * a closed set of string codes (rather than thrown errors) so callers can
 * switch on them exhaustively and decide what to show the user without
 * inspecting error messages or stack traces.
 *
 * - `nxdomain` — the hostname doesn't exist in DNS at all.
 * - `no_records` — the hostname exists but has no TXT records.
 * - `timeout` — the query didn't get an answer in time.
 * - `server_failure` — the resolver returned an error (e.g. SERVFAIL) rather
 *   than an authoritative answer.
 */
export type TxtResolutionFailureReason =
  'nxdomain' | 'no_records' | 'timeout' | 'server_failure'

/**
 * Result of a TXT lookup for a single hostname. Each string in `records` is
 * one full TXT record value, already joined from its DNS character-string
 * chunks (a single TXT record can be split across multiple
 * quoted-and-concatenated segments on the wire; resolver implementations own
 * that reassembly so callers only ever see complete values).
 */
export type TxtResolution =
  | { ok: true; records: string[] }
  | { ok: false; reason: TxtResolutionFailureReason }

/**
 * The injected DNS boundary. This is the only place raw DNS IO is allowed to
 * happen from — everything above it (the check function, the state machine,
 * API routes) depends on this interface, never on a concrete resolver. That
 * separation is what makes the verification flow demoable and testable
 * without waiting on real DNS propagation or TTLs.
 *
 * Implementations must never throw. Every failure mode — the hostname
 * doesn't exist, DNS timed out, the server errored — is represented as a
 * value in {@link TxtResolution}, not as a rejected promise. A resolver that
 * throws breaks every caller's exhaustive handling of the `ok: false` case.
 */
export interface DnsResolver {
  resolveTxt(hostname: string): Promise<TxtResolution>
}
