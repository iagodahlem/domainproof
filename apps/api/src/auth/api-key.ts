import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { Database } from "../db/client.js";
import { apiKeys } from "../db/schema.js";
import { parseApiKey, type ApiKeyMode } from "../keys/parse.js";

/**
 * Hono context variables set by {@link createApiKeyAuthMiddleware} for any
 * handler downstream of it.
 */
export interface ApiKeyAuthVariables {
  projectId: string;
  mode: ApiKeyMode;
  keyId: string;
}

function invalidApiKey() {
  return {
    body: {
      error: { code: "invalid_api_key", message: "Invalid API key" },
    },
    status: 401 as const,
  };
}

/**
 * Hono middleware for the public API: authenticates a request via
 * `Authorization: Bearer dp_<mode>_<keyId>_<secret>`.
 *
 * Anti-enumeration by construction: an unknown `key_id`, a revoked key, a
 * `key_id`/`mode` mismatch, and a wrong secret all return the exact same
 * 401 body (`invalid_api_key`). Nothing here distinguishes "this key_id
 * doesn't exist" from "it exists but the secret is wrong" — that
 * distinction is exactly what would let an attacker enumerate valid
 * key_ids by timing or by message differences.
 *
 * The secret comparison itself is constant-time: both the presented
 * secret and the stored value are compared as fixed-length SHA-256
 * digests via `crypto.timingSafeEqual`, never as raw strings.
 *
 * `last_used_at` is updated fire-and-forget (not awaited before
 * responding). Tradeoff: this keeps auth latency independent of the
 * write path, but the timestamp is best-effort — a write can be lost if
 * the process exits immediately after, and it's not suitable as an audit
 * trail, only as an approximate "last seen" for dashboards.
 */
export function createApiKeyAuthMiddleware(
  db: Database,
): MiddlewareHandler<{ Variables: ApiKeyAuthVariables }> {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
      const { body, status } = invalidApiKey();
      return c.json(body, status);
    }

    const presented = header.slice("Bearer ".length).trim();
    const parsed = parseApiKey(presented);
    if (!parsed.ok) {
      const { body, status } = invalidApiKey();
      return c.json(body, status);
    }

    const { mode, keyId, secret } = parsed.value;

    const [row] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyId, keyId))
      .limit(1);

    if (!row || row.revokedAt || row.mode !== mode) {
      const { body, status } = invalidApiKey();
      return c.json(body, status);
    }

    const presentedHash = createHash("sha256").update(secret).digest();
    const storedHash = Buffer.from(row.secretHash, "hex");

    const matches =
      presentedHash.length === storedHash.length &&
      timingSafeEqual(presentedHash, storedHash);

    if (!matches) {
      const { body, status } = invalidApiKey();
      return c.json(body, status);
    }

    void (async () => {
      try {
        await db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, row.id));
      } catch (err) {
        console.error("Failed to update api key last_used_at", err);
      }
    })();

    c.set("projectId", row.projectId);
    c.set("mode", row.mode);
    c.set("keyId", row.keyId);
    await next();
  };
}
