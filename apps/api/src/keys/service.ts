import { createHash } from "node:crypto";
import { generateToken } from "@domainproof/core";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { apiKeys } from "../db/schema.js";
import { generateKeyId } from "./encoding.js";
import { formatApiKey, type ApiKeyMode } from "./parse.js";

type ApiKeyRow = typeof apiKeys.$inferSelect;

/**
 * Display-safe view of an api_keys row: never carries `secretHash`, and
 * never carries a full key — only what's safe to render in a dashboard
 * list after the one-time creation/rotation response has been shown and
 * dismissed.
 */
export interface ApiKeyListItem {
  keyId: string;
  mode: ApiKeyMode;
  /** `dp_<mode>_<keyId>_...<last4>` — enough to recognize the key, never the secret. */
  maskedKey: string;
  last4: string;
  name: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreateKeyResult {
  /** The full `dp_<mode>_<keyId>_<secret>` key. Shown exactly once — never persisted or logged. */
  key: string;
  apiKey: ApiKeyListItem;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function toListItem(row: ApiKeyRow): ApiKeyListItem {
  return {
    keyId: row.keyId,
    mode: row.mode,
    maskedKey: `dp_${row.mode}_${row.keyId}_...${row.last4}`,
    last4: row.last4,
    name: row.name,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  };
}

/**
 * Creates a new API key for a project. The full key (including the
 * secret) is returned exactly once, in this response — only its SHA-256
 * hash and last4 are persisted, so there is no way to recover it later,
 * by design.
 */
export async function createKey(
  db: Database,
  projectId: string,
  mode: ApiKeyMode,
  name?: string,
): Promise<CreateKeyResult> {
  const keyId = generateKeyId();
  const secret = generateToken();
  const key = formatApiKey({ mode, keyId, secret });

  const [row] = await db
    .insert(apiKeys)
    .values({
      projectId,
      mode,
      keyId,
      secretHash: hashSecret(secret),
      last4: secret.slice(-4),
      name: name ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create API key: insert returned no row");
  }

  return { key, apiKey: toListItem(row) };
}

/** Lists all keys (any mode, any status) belonging to a project. Never returns hashes or secrets. */
export async function listKeys(
  db: Database,
  projectId: string,
): Promise<ApiKeyListItem[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.projectId, projectId));

  return rows.map(toListItem);
}

/**
 * Revokes a key. Scoped to `projectId` so a key belonging to a different
 * project (and, transitively, a different account) is treated as not
 * found rather than acted upon. Idempotent: revoking an already-revoked
 * key just refreshes `revokedAt` rather than erroring.
 */
export async function revokeKey(
  db: Database,
  projectId: string,
  keyId: string,
): Promise<ApiKeyListItem | null> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.projectId, projectId), eq(apiKeys.keyId, keyId)))
    .returning();

  return row ? toListItem(row) : null;
}

/**
 * Rotates a key: atomically revokes the existing key and creates a
 * replacement with the same name and mode, returning the replacement's
 * one-time full key. Atomic (single transaction) so a crash mid-rotation
 * can't leave the caller with neither a working old key nor a usable new
 * one, or a revoked old key with no replacement.
 *
 * Returns `null` if no key with `keyId` exists under `projectId` (the
 * caller should surface this as a 404, matching the anti-enumeration
 * stance used elsewhere in the key lifecycle).
 */
export async function rotateKey(
  db: Database,
  projectId: string,
  keyId: string,
): Promise<CreateKeyResult | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.projectId, projectId), eq(apiKeys.keyId, keyId)))
      .limit(1);

    if (!existing) {
      return null;
    }

    await tx
      .update(apiKeys)
      .set({ revokedAt: existing.revokedAt ?? new Date() })
      .where(eq(apiKeys.id, existing.id));

    const newKeyId = generateKeyId();
    const secret = generateToken();
    const key = formatApiKey({ mode: existing.mode, keyId: newKeyId, secret });

    const [row] = await tx
      .insert(apiKeys)
      .values({
        projectId,
        mode: existing.mode,
        keyId: newKeyId,
        secretHash: hashSecret(secret),
        last4: secret.slice(-4),
        name: existing.name,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to rotate API key: insert returned no row");
    }

    return { key, apiKey: toListItem(row) };
  });
}
