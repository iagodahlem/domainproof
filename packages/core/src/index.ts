export * from "./domain.js";
export * from "./states.js";

/**
 * DNS resolution contract shared by the core verification pipeline and the SDK.
 * Intentionally empty for now — the real contract (record lookups, TTL handling,
 * retry/backoff semantics) lands with the verification engine.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- placeholder, filled in once the verification engine lands
export interface DnsResolver {}
