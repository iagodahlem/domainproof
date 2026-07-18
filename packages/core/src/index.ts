/**
 * Domain verification statuses tracked across the DomainProof pipeline.
 */
export const DOMAIN_STATUSES = [
  "not_started",
  "pending",
  "verified",
  "temporarily_failed",
  "failed",
] as const;

export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

/**
 * DNS resolution contract shared by the core verification pipeline and the SDK.
 * Intentionally empty for now — the real contract (record lookups, TTL handling,
 * retry/backoff semantics) lands in FD-013.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- placeholder, filled in FD-013
export interface DnsResolver {}
