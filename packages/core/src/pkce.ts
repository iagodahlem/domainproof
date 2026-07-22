import { createHash, randomBytes } from 'node:crypto'

/**
 * RFC 7636 recommends 32-96 bytes of randomness for a PKCE code verifier,
 * base64url-encoded. 32 bytes (256 bits) is the same entropy budget the
 * rest of this package uses for bearer credentials (see `token.ts`'s
 * `TOKEN_BYTE_LENGTH`), just encoded differently since PKCE's own spec
 * fixes the alphabet.
 */
const CODE_VERIFIER_BYTE_LENGTH = 32

/**
 * `Buffer`'s `base64url` encoding already produces the unpadded,
 * URL-safe alphabet RFC 7636 requires for both the code verifier and the
 * S256 code challenge — no manual padding-stripping needed.
 */
function base64Url(bytes: Buffer): string {
  return bytes.toString('base64url')
}

/**
 * Generates a fresh PKCE code verifier: the secret half of the
 * authorize/token pair that proves the same party which started an OAuth
 * authorization request is the one completing it. Callers thread this
 * through their own signed `state` (see `modules/cloudflare/domain/state.ts`
 * in the api) rather than any server-side session store, since this
 * package has no notion of persistence.
 */
export function generateCodeVerifier(): string {
  return base64Url(randomBytes(CODE_VERIFIER_BYTE_LENGTH))
}

/**
 * Derives the S256 PKCE code challenge from a verifier: `BASE64URL(SHA256(verifier))`,
 * per RFC 7636 §4.2. Deterministic and pure — given the same verifier, always
 * produces the same challenge, so an authorize request can compute the
 * challenge to send up front and a later callback can recompute it from the
 * same verifier for comparison if a caller ever needs to (Cloudflare's own
 * token endpoint does this comparison; this api never needs to redo it, but
 * a pure function is the honest shape for RFC 7636 math regardless of who
 * ends up calling it).
 */
export function codeChallengeFromVerifier(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest())
}
