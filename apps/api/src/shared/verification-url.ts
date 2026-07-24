import { env } from '../env'

/**
 * Builds the hosted verification page's absolute URL for a claim's
 * `frontendToken` — every plane that hands out or redirects to an absolute
 * link (the public v1 API's `verificationUrl`, the Cloudflare one-click
 * callback) builds it here instead of hardcoding a host, so
 * `VERIFICATION_BASE_URL` (see `env.ts`) is the one place that changes per
 * environment.
 */
export function buildVerificationUrl(frontendToken: string): string {
  return `${env.VERIFICATION_BASE_URL}/${frontendToken}`
}
