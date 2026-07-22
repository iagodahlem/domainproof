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

/**
 * Result of an NS lookup for a domain. Reuses {@link TxtResolutionFailureReason}
 * rather than inventing a parallel closed set — an NS lookup is a DNS query
 * like any other, and callers (see `detectProvider` in `provider.ts`) only
 * ever care about the success case's nameserver hostnames, so the failure
 * detail doesn't need its own vocabulary.
 */
export type NsResolution =
  | { ok: true; nameservers: string[] }
  | { ok: false; reason: TxtResolutionFailureReason }

/**
 * The injected NS-lookup boundary — the sibling of {@link DnsResolver} for
 * the one other kind of DNS query this package's callers need: "which
 * nameservers serve this domain", the fact `detectProvider` turns into a
 * provider name. Kept as its own interface rather than a second method on
 * `DnsResolver` because the two answer genuinely different questions (a
 * TXT record's value vs. who operates the zone) and not every `DnsResolver`
 * implementation necessarily wants to implement both — `infra/dns/sandbox.ts`'s
 * per-challenge resolver, for one, has no meaningful nameservers to report.
 *
 * Implementations must never throw, same contract as `DnsResolver`.
 */
export interface NsResolver {
  resolveNs(domain: string): Promise<NsResolution>
}
