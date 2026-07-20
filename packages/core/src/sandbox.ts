import { normalizeDomain, registrableDomain } from './domain'

// RFC 6761 permanently reserves `.test` for documentation and testing, so it
// can never be delegated in real DNS or collide with a real owner's domain
// (see domain.ts). That's what makes it safe to treat as a sandbox
// namespace that never touches real DNS or a real domain owner's key mode.
const SANDBOX_TLD = 'test'

/**
 * True when `domain`'s registrable domain's TLD is `test` — i.e. it belongs
 * to the sandbox namespace. Pure domain classification (string parsing via
 * {@link normalizeDomain}/{@link registrableDomain} only, no IO), so it
 * lives in core rather than next to the DNS resolver that also happens to
 * consume it (`apps/api/src/infra/dns/sandbox.ts`, which re-exports this):
 * `modules/domains` needs the same classification — to gate `.test` claims
 * by API key mode — without being allowed to import a concrete infra
 * adapter (see ARCHITECTURE.md's dependency rules).
 */
export function isSandboxDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain)
  if (!normalized.ok) {
    return false
  }
  return registrableDomain(normalized.domain).endsWith(`.${SANDBOX_TLD}`)
}
