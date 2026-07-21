import { normalizeDomain } from '@domainproof/core'

/**
 * Normalizes a `domain` list filter the same way `claimDomain` normalizes a
 * claim's `domain` input, so a filter value differing only in
 * casing/punycode from how it was actually claimed still matches. Falls
 * back to the raw input on failure rather than erroring — an
 * unnormalizable filter value simply can't match any stored (always
 * normalized) domain, so it naturally yields an empty page instead of
 * needing a dedicated error path.
 */
export function normalizeDomainFilter(input: string): string {
  const normalized = normalizeDomain(input)
  return normalized.ok ? normalized.domain : input
}
