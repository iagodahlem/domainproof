import { randomBytes } from "node:crypto";

/**
 * RFC 4648 base32 alphabet, lowercased — the same alphabet
 * `@domainproof/core`'s verification-token generator uses
 * (`packages/core/src/token.ts`). The bit-packing encoder below is
 * duplicated rather than imported from core because API key ids need a
 * different, fixed output length (12 chars) than core's token generator
 * exposes (which is hardcoded to 128-bit/26-char tokens); it's the same
 * ~15-line approach, not a new one.
 */
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

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

/** Fixed length of a key id's public identifier segment. */
export const KEY_ID_LENGTH = 12;

/**
 * Generates the public key-id segment of an API key: 12 lowercase base32
 * characters (`[a-z2-7]`). Unlike the secret, this is not sensitive — it's
 * shown in dashboards, logs, and error messages, and exists purely so a
 * presented key can be looked up in one indexed query instead of scanning
 * every key's hash. 8 random bytes (64 bits) encode to 13 base32
 * characters; the 13th is dropped to land on a clean, fixed 12-char
 * length (60 bits of entropy), which is more than enough to make
 * collisions negligible against the column's unique constraint.
 */
export function generateKeyId(): string {
  return encodeBase32Lowercase(randomBytes(8)).slice(0, KEY_ID_LENGTH);
}
