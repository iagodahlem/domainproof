import { Resolver } from "node:dns/promises";

import { registrableDomain } from "../domain.js";
import type { DnsResolver, TxtResolution, TxtResolutionFailureReason } from "../resolver.js";

/**
 * The production {@link DnsResolver}. This is the only file in the package
 * allowed to import `node:dns` — see the architecture note on
 * {@link DnsResolver} for why that boundary matters.
 *
 * ## Why query authoritative nameservers instead of a recursive resolver
 *
 * A plain `resolveTxt` call goes to whatever recursive resolver the host is
 * configured with (or, here, one of {@link NodeDnsResolverOptions.publicResolvers}).
 * Recursive resolvers cache negative answers too: an `NXDOMAIN` or empty-TXT
 * response gets cached for the zone's SOA minimum TTL, which is commonly
 * 30-60+ minutes. That's fine for steady-state lookups, but it's actively
 * hostile to the "add a TXT record, click verify" flow this product exists
 * for — a user who clicks verify 20 seconds after publishing their record can
 * get haunted by a cached miss from before the record existed, for up to an
 * hour, even though the record is live in the zone.
 *
 * The domain's own authoritative nameservers don't have this problem: they
 * serve the zone directly, so a query against them reflects the current zone
 * contents with no propagation-cache lag. Querying them for the re-check path
 * sidesteps the stale-negative-cache problem entirely instead of asking the
 * user to wait out someone else's TTL.
 *
 * ## Strategy
 *
 * 1. Resolve NS records for the hostname's registrable domain via a public
 *    resolver, then resolve each nameserver hostname to an IP (see
 *    {@link discoverAuthoritativeNameservers}).
 * 2. Query TXT for the exact hostname directly against an authoritative IP.
 *    If that query times out or errors, try the next authoritative IP,
 *    bounded to a handful of attempts — an authoritative server answering
 *    with a definitive `NXDOMAIN`/no-data response is not a failure to
 *    retry, it's the answer.
 * 3. If authoritative discovery fails outright, or every authoritative
 *    attempt errors without producing a definitive answer, fall back to a
 *    plain TXT query against the public resolvers so the caller still gets
 *    an answer (just without the freshness guarantee).
 *
 * Every step maps failures onto {@link TxtResolution} — this resolver never
 * throws, per the {@link DnsResolver} contract.
 */

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8"];

/** How many NS hostnames we'll attempt to resolve to an IP. */
const MAX_NAMESERVERS_TO_RESOLVE = 3;

/**
 * How many authoritative IPs we'll keep (and, in {@link createNodeDnsResolver},
 * try in sequence) — this is the "max 2-3 attempts total" bound on the
 * authoritative query path.
 */
const MAX_AUTHORITATIVE_IPS = 3;

/**
 * The subset of `node:dns/promises`' `Resolver` this module depends on.
 * Narrowing to an interface (rather than depending on the `Resolver` class
 * directly) is what lets tests inject a fake that never touches the network.
 */
export interface NodeDnsClient {
  setServers(servers: readonly string[]): void;
  resolveTxt(hostname: string): Promise<string[][]>;
  resolveNs(hostname: string): Promise<string[]>;
  resolve4(hostname: string): Promise<string[]>;
}

export interface NodeDnsClientOptions {
  /** Query timeout in milliseconds, passed through to `node:dns`'s own timeout. */
  timeout?: number;
  /** Tries per server; we manage our own attempt/fallback ladder, so this stays at 1. */
  tries?: number;
}

/**
 * Factory for a {@link NodeDnsClient}. A fresh client is created per query so
 * each attempt can point `setServers` at a different (authoritative or
 * public) IP without cross-contaminating other in-flight queries.
 */
export type CreateNodeDnsClient = (options?: NodeDnsClientOptions) => NodeDnsClient;

const createRealNodeDnsClient: CreateNodeDnsClient = (options) => new Resolver(options);

export interface NodeDnsResolverOptions {
  /**
   * Per-query timeout in milliseconds. Applied both as the underlying
   * `node:dns` resolver's own timeout and as a `Promise.race` safety net
   * around every query, so a client that ignores its configured timeout
   * (as a test fake might) still can't hang the caller.
   *
   * @default 5000
   */
  timeoutMs?: number;

  /**
   * Public recursive resolvers used to discover authoritative nameservers
   * and as the last-resort fallback when the authoritative path fails.
   *
   * @default ["1.1.1.1", "8.8.8.8"]
   */
  publicResolvers?: readonly string[];

  /**
   * Low-level DNS client factory. Defaults to real `node:dns/promises`
   * `Resolver` instances; tests inject a fake here so the resolver's
   * strategy (authoritative discovery, attempt bounding, fallback, error
   * mapping) can be exercised without any real network IO.
   */
  dns?: CreateNodeDnsClient;
}

/**
 * Failure reasons for {@link discoverAuthoritativeNameservers}. Reuses the
 * same closed set as {@link TxtResolutionFailureReason}: NS discovery is a
 * DNS lookup like any other, so the same "what actually happened" taxonomy
 * applies. `server_failure` additionally covers "we got NS records back but
 * couldn't resolve any of them to a usable IP" — not a literal SERVFAIL, but
 * grouped here rather than inventing a one-off reason, since callers treat it
 * the same way: we don't have a usable authoritative answer.
 */
export type NameserverDiscoveryFailureReason = TxtResolutionFailureReason;

export type NameserverDiscoveryResult =
  | { ok: true; nameservers: string[]; ips: string[] }
  | { ok: false; reason: NameserverDiscoveryFailureReason };

export interface DiscoverAuthoritativeNameserversOptions {
  timeoutMs?: number;
  publicResolvers?: readonly string[];
  dns?: CreateNodeDnsClient;
}

/**
 * Synthetic error thrown by {@link withTimeout} when the wrapped query hasn't
 * settled within `timeoutMs`. Carries `code: "ETIMEOUT"` so it flows through
 * {@link mapDnsErrorToFailureReason} the same way a real `node:dns` timeout
 * does — one mapping path, regardless of whether the timeout came from the
 * underlying client or from our own safety net.
 */
class QueryTimeoutError extends Error {
  readonly code = "ETIMEOUT";

  constructor() {
    super("DNS query timed out");
    this.name = "QueryTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new QueryTimeoutError()), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Maps a rejected `node:dns` promise (or our own {@link QueryTimeoutError})
 * onto the closed {@link TxtResolutionFailureReason} set.
 *
 * `node:dns/promises` rejects with an `Error` carrying a `.code` string:
 * - `ENOTFOUND` -> the name doesn't exist at all -> `nxdomain`.
 * - `ENODATA` -> the name exists but has no records of the requested type
 *   -> `no_records`.
 * - `ETIMEOUT` (real or synthetic) -> `timeout`.
 * - anything else (`ESERVFAIL`, `EREFUSED`, connection errors, or a code we
 *   don't recognize) -> `server_failure`, the catch-all for "the resolver
 *   didn't give us an authoritative answer."
 */
function mapDnsErrorToFailureReason(error: unknown): TxtResolutionFailureReason {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;

  switch (code) {
    case "ENOTFOUND":
      return "nxdomain";
    case "ENODATA":
      return "no_records";
    case "ETIMEOUT":
      return "timeout";
    default:
      return "server_failure";
  }
}

/**
 * Resolves NS records for `domain` (via a public resolver) and then resolves
 * each nameserver hostname to an IPv4 address, keeping the first address per
 * nameserver up to {@link MAX_AUTHORITATIVE_IPS}.
 *
 * `domain` is queried as given — callers that want the registrable domain's
 * nameservers (the usual case for TXT verification) must pass that in
 * themselves, e.g. via {@link registrableDomain}. Kept separate from
 * `resolveTxt`'s hostname-to-domain step so this is reusable for looking up
 * NS records on an arbitrary domain, which is what the planned DNS-provider
 * detection feature needs (nameserver hostnames like `ns1.cloudflare.com`
 * reveal which provider hosts the zone).
 *
 * Never throws — every failure comes back as `{ ok: false, reason }`.
 */
export async function discoverAuthoritativeNameservers(
  domain: string,
  opts: DiscoverAuthoritativeNameserversOptions = {},
): Promise<NameserverDiscoveryResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const publicResolvers = opts.publicResolvers ?? DEFAULT_PUBLIC_RESOLVERS;
  const createClient = opts.dns ?? createRealNodeDnsClient;

  const publicClient = createClient({ timeout: timeoutMs, tries: 1 });
  publicClient.setServers(publicResolvers);

  let nameservers: string[];
  try {
    nameservers = await withTimeout(publicClient.resolveNs(domain), timeoutMs);
  } catch (error) {
    return { ok: false, reason: mapDnsErrorToFailureReason(error) };
  }

  if (nameservers.length === 0) {
    return { ok: false, reason: "no_records" };
  }

  const ips: string[] = [];
  for (const nameserver of nameservers.slice(0, MAX_NAMESERVERS_TO_RESOLVE)) {
    if (ips.length >= MAX_AUTHORITATIVE_IPS) {
      break;
    }

    try {
      const addresses = await withTimeout(publicClient.resolve4(nameserver), timeoutMs);
      const [firstAddress] = addresses;
      if (firstAddress !== undefined) {
        ips.push(firstAddress);
      }
    } catch {
      // This nameserver hostname didn't resolve to an IP; move on to the
      // next one rather than failing discovery outright.
    }
  }

  if (ips.length === 0) {
    return { ok: false, reason: "server_failure" };
  }

  return { ok: true, nameservers, ips };
}

/**
 * Runs a single TXT query against `servers` and maps the outcome onto
 * {@link TxtResolution}. Joins each record's DNS character-string chunks
 * with `""` per DNS semantics (`node:dns` hands back `string[][]`, one
 * chunk-array per record) so callers only ever see whole values.
 */
async function queryTxt(
  createClient: CreateNodeDnsClient,
  servers: readonly string[],
  hostname: string,
  timeoutMs: number,
): Promise<TxtResolution> {
  const client = createClient({ timeout: timeoutMs, tries: 1 });
  client.setServers(servers);

  try {
    const chunkedRecords = await withTimeout(client.resolveTxt(hostname), timeoutMs);

    if (chunkedRecords.length === 0) {
      return { ok: false, reason: "no_records" };
    }

    return { ok: true, records: chunkedRecords.map((chunks) => chunks.join("")) };
  } catch (error) {
    return { ok: false, reason: mapDnsErrorToFailureReason(error) };
  }
}

/**
 * `true` when `resolution` is a definitive answer from whichever server
 * produced it — a success, or an authoritative negative (`nxdomain` /
 * `no_records`). Those are facts about the zone, not query failures, so the
 * authoritative attempt loop stops on them rather than trying another IP.
 * `timeout` and `server_failure` are query-level problems worth retrying
 * against the next authoritative IP (or falling back).
 */
function isDefinitiveAnswer(resolution: TxtResolution): boolean {
  return resolution.ok || resolution.reason === "nxdomain" || resolution.reason === "no_records";
}

async function resolveTxtViaAuthoritativeThenFallback(
  createClient: CreateNodeDnsClient,
  publicResolvers: readonly string[],
  timeoutMs: number,
  hostname: string,
): Promise<TxtResolution> {
  const discovery = await discoverAuthoritativeNameservers(registrableDomain(hostname), {
    timeoutMs,
    publicResolvers,
    dns: createClient,
  });

  if (discovery.ok) {
    for (const ip of discovery.ips) {
      const resolution = await queryTxt(createClient, [ip], hostname, timeoutMs);
      if (isDefinitiveAnswer(resolution)) {
        return resolution;
      }
      // Timed out or errored against this authoritative IP — try the next
      // one. `discovery.ips` is already bounded to MAX_AUTHORITATIVE_IPS.
    }
  }

  // Authoritative discovery failed outright, or every authoritative attempt
  // errored without a definitive answer. Fall back to the public resolvers
  // so the caller still gets an answer, just without the freshness
  // guarantee the authoritative path provides.
  return queryTxt(createClient, publicResolvers, hostname, timeoutMs);
}

/**
 * Creates the production {@link DnsResolver}, backed by `node:dns/promises`
 * with an authoritative-nameserver query path (see the module doc comment
 * for why). Never throws — every failure mode maps onto {@link TxtResolution}.
 */
export function createNodeDnsResolver(options: NodeDnsResolverOptions = {}): DnsResolver {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const publicResolvers = options.publicResolvers ?? DEFAULT_PUBLIC_RESOLVERS;
  const createClient = options.dns ?? createRealNodeDnsClient;

  return {
    resolveTxt(hostname: string): Promise<TxtResolution> {
      return resolveTxtViaAuthoritativeThenFallback(createClient, publicResolvers, timeoutMs, hostname);
    },
  };
}
