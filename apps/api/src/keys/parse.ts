import { KEY_ID_LENGTH } from "./encoding.js";

export type ApiKeyMode = "test" | "live";

export interface ParsedApiKey {
  mode: ApiKeyMode;
  keyId: string;
  secret: string;
}

export type ParseApiKeyResult =
  | { ok: true; value: ParsedApiKey }
  | { ok: false };

// The key id is public (see keys/encoding.ts); the secret is core's
// generateToken() output — 26 lowercase base32 chars (128 bits).
const KEY_ID_PATTERN = new RegExp(`^[a-z2-7]{${KEY_ID_LENGTH}}$`);
const SECRET_PATTERN = /^[a-z2-7]{26}$/;

/**
 * Parses a presented API key string of the form
 * `dp_<mode>_<keyId>_<secret>`.
 *
 * Never throws. Any malformed input — wrong prefix, wrong segment count,
 * unknown mode, wrong-length or wrong-alphabet id/secret — yields
 * `{ ok: false }` uniformly, so callers (the auth middleware) can turn
 * every parse failure into the same 401 response as a valid-looking but
 * wrong key, instead of a parse exception forcing a different code path
 * that might leak information through its shape or timing.
 */
export function parseApiKey(raw: string): ParseApiKeyResult {
  const parts = raw.split("_");
  if (parts.length !== 4) {
    return { ok: false };
  }

  const [prefix, mode, keyId, secret] = parts as [string, string, string, string];

  if (prefix !== "dp") {
    return { ok: false };
  }
  if (mode !== "test" && mode !== "live") {
    return { ok: false };
  }
  if (!KEY_ID_PATTERN.test(keyId)) {
    return { ok: false };
  }
  if (!SECRET_PATTERN.test(secret)) {
    return { ok: false };
  }

  return { ok: true, value: { mode, keyId, secret } };
}

/** Builds the full, presentable key string from its parts. */
export function formatApiKey(parts: ParsedApiKey): string {
  return `dp_${parts.mode}_${parts.keyId}_${parts.secret}`;
}
