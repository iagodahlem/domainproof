import type { DnsResolver } from '@domainproof/core'

/**
 * Everything `verifyDomain` needs to pick (or build) the `DnsResolver` for
 * one verification attempt: the domain being checked (decides sandbox vs.
 * real DNS), the current challenge's exact TXT hostname/value (what a
 * sandbox resolver answers for), the brand slug the challenge was issued
 * under (needed to fabricate the sandbox's wrong-value fixture), when the
 * challenge was created (a sandbox resolver's elapsed-time clock origin),
 * and the service's own injected clock (so a sandbox's simulated
 * propagation delay is driven by the same `now` as everything else in the
 * call, and stays deterministic in tests).
 */
export interface ResolverForChallengeInput {
  domain: string
  recordHost: string
  recordValue: string
  brandSlug: string
  challengeCreatedAt: Date
  now: () => Date
}

/**
 * Module-owned port: resolves which `DnsResolver` a verification attempt
 * should run against. `.test` sandbox domains and real-world domains need
 * genuinely different resolver implementations
 * (`infra/dns/sandbox.ts`'s `createSandboxResolver` vs.
 * `infra/dns/node-dns.ts`'s `createNodeDnsResolver`), but that decision —
 * and the concrete adapters themselves — is composition-root wiring
 * (`app.ts`), not something `modules/domains` is allowed to know about
 * (`infra/dns` is off-limits to modules; see ARCHITECTURE.md's dependency
 * rules). `verifyDomain` takes this as an injected dependency instead of
 * importing either adapter itself.
 */
export type ResolverForChallenge = (
  input: ResolverForChallengeInput,
) => DnsResolver
