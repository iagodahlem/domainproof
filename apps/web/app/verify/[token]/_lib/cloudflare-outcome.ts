import type { CalloutTone } from '@domainproof/ui'

/**
 * Mirrors the `?cloudflare=<outcome>` values `apps/api/src/apis/frontend/routes/cloudflare.ts`'s
 * callback redirects with (see README.md's "Cloudflare one-click DNS setup"
 * section) — kept as a plain string union here rather than imported from the
 * api, since this page only ever reads it off a URL query param, never calls
 * into api code directly.
 */
export type CloudflareOutcome =
  | 'success'
  | 'denied'
  | 'no_matching_zone'
  | 'record_create_failed'
  | 'exchange_failed'
  | 'not_found'

export interface CloudflareOutcomeView {
  tone: CalloutTone
  message: string
}

/**
 * Honest, next-action-oriented copy for each outcome the Cloudflare callback
 * can redirect back with — every branch still points at the manual
 * instructions right below it (an honest callout beside the manual
 * instructions), since none of these failures leave the record written.
 * An unrecognized string falls back to a generic message rather than
 * throwing — this reads straight off a URL query param, which anyone can
 * edit by hand.
 */
export function describeCloudflareOutcome(
  outcome: string,
): CloudflareOutcomeView {
  switch (outcome as CloudflareOutcome) {
    case 'success':
      return {
        tone: 'accent',
        message: 'Cloudflare added the record for you — checking now…',
      }
    case 'denied':
      return {
        tone: 'neutral',
        message:
          'You declined the Cloudflare authorization, so nothing was changed. Add the record manually below, or try the button again.',
      }
    case 'no_matching_zone':
      return {
        tone: 'warning',
        message:
          "We couldn't find this domain in that Cloudflare account. Make sure you're signed in to the account that manages its DNS, then try again — or add the record manually below.",
      }
    case 'record_create_failed':
      return {
        tone: 'warning',
        message:
          "We connected to Cloudflare but couldn't create the record automatically. Add it manually below.",
      }
    case 'exchange_failed':
      return {
        tone: 'warning',
        message:
          'Something went wrong connecting to Cloudflare. Try again, or add the record manually below.',
      }
    case 'not_found':
      return {
        tone: 'warning',
        message: 'This verification link is no longer active.',
      }
    default:
      return {
        tone: 'neutral',
        message:
          'Something unexpected happened setting up Cloudflare. Add the record manually below.',
      }
  }
}
