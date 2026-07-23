import type { DomainProofApiError } from '@domainproof/sdk'

/**
 * Overrides for API error codes whose default `message` isn't actionable
 * enough for an agent operating blind (no dashboard, no browser) — e.g.
 * `'Invalid API key'` doesn't say where to get a valid one. Codes not
 * listed here (`domain_already_claimed`, `invalid_status`, ...) already
 * carry a specific, actionable message from the API itself.
 */
const MESSAGE_OVERRIDES: Record<string, string> = {
  invalid_api_key:
    "The configured DOMAINPROOF_API_KEY is invalid or has been revoked. Get a fresh key from your DomainProof dashboard and update this server's environment.",
  not_found:
    'No matching domain was found for this project and api key. Call list_domains to see which domains this key can see.',
  rate_limited:
    'Rate limit exceeded for this api key. Wait a few seconds before retrying.',
  network_error:
    'Could not reach the DomainProof API. Check DOMAINPROOF_BASE_URL (if set) and network connectivity.',
  unknown_error:
    'The DomainProof API returned an unexpected response. Retrying may help; if it persists, check DOMAINPROOF_BASE_URL.',
}

/** Turns a `DomainProofApiError` into a message an agent can act on without dashboard/browser access. */
export function describeError(error: DomainProofApiError): string {
  return MESSAGE_OVERRIDES[error.code] ?? error.message
}
