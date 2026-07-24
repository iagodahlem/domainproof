import { DomainProof } from '@domainproof/sdk'

let cached: DomainProof | null = null

const DEV_DOMAINPROOF_BASE_URL = 'http://localhost:3001'

/**
 * Resolves the demo SDK client's base URL. An explicit
 * `DEMO_DOMAINPROOF_BASE_URL` always wins. Otherwise: Vercel preview and
 * production builds both run with `NODE_ENV=production`, and preview
 * already sets this var explicitly, so unset there falls through to the
 * SDK's own production default — only local `next dev` (`NODE_ENV`
 * `development`) is affected, where unset instead defaults to this repo's
 * local api port, so a local run never claims a domain against production
 * by accident.
 */
export function resolveDemoBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return (
    env.DEMO_DOMAINPROOF_BASE_URL ??
    (env.NODE_ENV === 'development' ? DEV_DOMAINPROOF_BASE_URL : undefined)
  )
}

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
    baseUrl: resolveDemoBaseUrl(),
  })
  return cached
}
