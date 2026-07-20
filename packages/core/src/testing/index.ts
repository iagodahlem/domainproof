/**
 * Official test doubles for core's injected ports (`DnsResolver`,
 * `HttpFetcher`). Exposed as a separate `@domainproof/core/testing`
 * subpath rather than from the package root: these are dev-time fixtures,
 * not part of the domain surface a production caller depends on. Core's
 * own tests import them by relative path; the api's tests (and any other
 * package's) import them via the subpath.
 */
export * from "./fixture-resolver";
export * from "./fixture-fetcher";
