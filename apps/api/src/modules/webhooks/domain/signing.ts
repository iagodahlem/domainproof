import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The three headers every webhook delivery carries, alongside
 * `content-type: application/json`. `id` is the delivery's own id (stable
 * across retries of the same delivery — see `service.ts`'s `runDelivery` —
 * so a receiver can dedupe redeliveries of the same logical event), `timestamp`
 * is Unix seconds at send time, and `signature` is `signPayload`'s output.
 * Documented in README.md's Webhooks section for integrators verifying
 * deliveries server-side.
 */
export const WEBHOOK_ID_HEADER = 'domainproof-webhook-id'
export const WEBHOOK_TIMESTAMP_HEADER = 'domainproof-webhook-timestamp'
export const WEBHOOK_SIGNATURE_HEADER = 'domainproof-webhook-signature'

/**
 * Signs `timestamp.body` with the endpoint's signing secret via HMAC-SHA256,
 * hex-encoded and prefixed `sha256=` (so the scheme can add other digests
 * later without an ambiguous bare hex string). Signing the timestamp
 * alongside the body — not just the body — is what lets a receiver reject a
 * replayed request whose signature is otherwise valid but whose timestamp
 * is stale.
 */
export function signPayload(
  secret: string,
  timestamp: string,
  body: string,
): string {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')
  return `sha256=${digest}`
}

/**
 * Constant-time verification of a delivery's signature — the function a
 * receiver's own webhook handler would call. Never throws on malformed
 * input (a garbage `signature` just fails to verify); only compares equal-
 * length buffers to `timingSafeEqual`, matching the pattern in
 * `@domainproof/core`'s `tokensMatch`.
 */
export function verifySignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = signPayload(secret, timestamp, body)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }
  return timingSafeEqual(expectedBuffer, actualBuffer)
}
