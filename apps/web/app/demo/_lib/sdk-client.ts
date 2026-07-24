import { DomainProof } from '@domainproof/sdk'

let cached: DomainProof | null = null

/**
 * One process-lifetime client, built from `DEMO_DOMAINPROOF_API_KEY` (see
 * apps/web/.env.example) — a test-mode key from a real DomainProof project,
 * created the same way any third-party integration would. This is the
 * demo's only touchpoint with DomainProof: no `@domainproof/core`, no
 * `apps/api` import, nothing but this SDK client.
 */
export function getDemoDomainProofClient(): DomainProof {
  if (cached) {
    return cached
  }

  const apiKey = process.env.DEMO_DOMAINPROOF_API_KEY
  if (!apiKey) {
    throw new Error(
      'DEMO_DOMAINPROOF_API_KEY is not set — see apps/web/.env.example.',
    )
  }

  cached = new DomainProof({
    apiKey,
    baseUrl: process.env.DEMO_DOMAINPROOF_BASE_URL,
  })
  return cached
}
