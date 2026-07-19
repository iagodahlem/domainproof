import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Verification tokens embed 128 bits of cryptographically random entropy —
 * enough that guessing or brute-forcing a valid token is computationally
 * infeasible. That's the entire trust model behind a DNS TXT challenge:
 * whoever can publish this exact value controls the domain.
 */
const TOKEN_BYTE_LENGTH = 16; // 128 bits

/**
 * RFC 4648 base32 alphabet, lowercased. DNS TXT records are compared
 * case-insensitively by a lot of tooling (some resolvers, registrar UIs,
 * copy-paste round trips), so tokens are generated lowercase from the
 * start rather than normalized later — there's no uppercase form to ever
 * disagree with.
 */
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * Minimal base32 encoder (no padding). Not worth a dependency for ~15
 * lines: read the input as a bitstream and emit 5 bits at a time as one
 * alphabet character.
 */
function encodeBase32Lowercase(bytes: Uint8Array): string {
  let bitBuffer = 0;
  let bitCount = 0;
  let output = "";

  for (const byte of bytes) {
    bitBuffer = (bitBuffer << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      const index = (bitBuffer >>> (bitCount - 5)) & 0x1f;
      output += BASE32_ALPHABET[index];
      bitCount -= 5;
    }
  }

  if (bitCount > 0) {
    const index = (bitBuffer << (5 - bitCount)) & 0x1f;
    output += BASE32_ALPHABET[index];
  }

  return output;
}

/**
 * Generates a fresh verification token: 128 bits of randomness from
 * node:crypto's CSPRNG, base32-lowercase-encoded without padding. 16 bytes
 * encodes to 26 characters (128 bits / 5 bits-per-char, rounded up), all
 * drawn from `[a-z2-7]`.
 */
export function generateToken(): string {
  return encodeBase32Lowercase(randomBytes(TOKEN_BYTE_LENGTH));
}

/**
 * Constant-time comparison of two tokens. A naive `===` (or a manual
 * char-by-char loop) short-circuits on the first differing character,
 * which leaks how many leading characters matched through response-time
 * variance — a timing side-channel on what is otherwise a secret
 * comparison. `timingSafeEqual` closes that, but it throws if the two
 * buffers differ in length, and untrusted input (typos, truncation,
 * garbage) will often have the "wrong" length. Hashing both sides to a
 * fixed-length SHA-256 digest first sidesteps that: the actual comparison
 * is always between two 32-byte buffers, so `timingSafeEqual` never
 * throws, and hashing doesn't weaken the check — finding a collision is no
 * easier than guessing the original token.
 */
export function tokensMatch(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * Default verification window: 72 hours. A challenge (token + publish
 * instructions) that hasn't verified within this window is treated as
 * stale rather than left pending indefinitely — the domain owner is asked
 * to regenerate, so an old token (possibly leaked, possibly copied into
 * the wrong place) can't surface and verify long after it was issued.
 */
export const DEFAULT_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * Pure expiry check. No clock reads happen inside this module — `now` is
 * always supplied by the caller — which keeps expiry fully determined by
 * its inputs and testable without mocking global time. `now` at exactly
 * `createdAt + ttlMs` counts as expired (the window is a hard cutoff, not
 * a "some time after" grace period).
 */
export function isExpired(
  createdAt: Date,
  now: Date,
  ttlMs: number = DEFAULT_TOKEN_TTL_MS,
): boolean {
  return now.getTime() - createdAt.getTime() >= ttlMs;
}
