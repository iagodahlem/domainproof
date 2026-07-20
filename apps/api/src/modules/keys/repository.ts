import { and, eq } from "drizzle-orm";
import type { Database } from "@infra/db/client";
import { apiKeys } from "@infra/db/schema";
import type { ApiKeyMode } from "./domain/parse";

export type ApiKeyRow = typeof apiKeys.$inferSelect;

export interface ApiKeyMaterial {
  keyId: string;
  secretHash: string;
  last4: string;
}

export interface ApiKeyInsert extends ApiKeyMaterial {
  projectId: string;
  mode: ApiKeyMode;
  name: string | null;
}

export interface RotateResult {
  previous: ApiKeyRow;
  replacement: ApiKeyRow;
}

/**
 * All db access for the keys module. This is the only file in
 * `modules/keys` allowed to import `@infra/db` — `service.ts`, `api-key.ts`
 * (the public API auth middleware), and everything above them depend on
 * this interface, never on the `api_keys` schema or a `Database` directly.
 */
export interface KeysRepository {
  insert(values: ApiKeyInsert): Promise<ApiKeyRow>;

  /** All keys (any mode, any status) belonging to a project. */
  listByProject(projectId: string): Promise<ApiKeyRow[]>;

  /**
   * Revokes a key scoped to `projectId`, so a key belonging to a different
   * project is treated as not found rather than acted upon. Idempotent:
   * revoking an already-revoked key just refreshes `revokedAt`.
   */
  revoke(projectId: string, keyId: string): Promise<ApiKeyRow | undefined>;

  /** Looks up a key by its public id alone — for the public-API auth middleware. */
  findByKeyId(keyId: string): Promise<ApiKeyRow | undefined>;

  /** Fire-and-forget "last seen" timestamp update; errors are the caller's to handle. */
  touchLastUsed(id: string): Promise<void>;

  /**
   * Atomically revokes the key at `keyId` (scoped to `projectId`) and
   * inserts a replacement carrying `newKeyMaterial` plus the existing
   * key's mode and name. Single transaction so a crash mid-rotation can't
   * leave the caller with neither a working old key nor a usable new one.
   * Returns `undefined` if no key with `keyId` exists under `projectId`.
   */
  rotate(
    projectId: string,
    keyId: string,
    newKeyMaterial: ApiKeyMaterial,
  ): Promise<RotateResult | undefined>;
}

export function createKeysRepository(db: Database): KeysRepository {
  return {
    async insert(values) {
      const [row] = await db.insert(apiKeys).values(values).returning();
      if (!row) {
        throw new Error("Failed to create API key: insert returned no row");
      }
      return row;
    },

    async listByProject(projectId) {
      return db.select().from(apiKeys).where(eq(apiKeys.projectId, projectId));
    },

    async revoke(projectId, keyId) {
      const [row] = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.projectId, projectId), eq(apiKeys.keyId, keyId)))
        .returning();
      return row;
    },

    async findByKeyId(keyId) {
      const [row] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyId, keyId))
        .limit(1);
      return row;
    },

    async touchLastUsed(id) {
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
    },

    async rotate(projectId, keyId, newKeyMaterial) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(apiKeys)
          .where(and(eq(apiKeys.projectId, projectId), eq(apiKeys.keyId, keyId)))
          .limit(1);

        if (!existing) {
          return undefined;
        }

        const [revoked] = await tx
          .update(apiKeys)
          .set({ revokedAt: existing.revokedAt ?? new Date() })
          .where(eq(apiKeys.id, existing.id))
          .returning();

        const [replacement] = await tx
          .insert(apiKeys)
          .values({
            projectId,
            mode: existing.mode,
            keyId: newKeyMaterial.keyId,
            secretHash: newKeyMaterial.secretHash,
            last4: newKeyMaterial.last4,
            name: existing.name,
          })
          .returning();

        if (!revoked || !replacement) {
          throw new Error("Failed to rotate API key: update or insert returned no row");
        }

        return { previous: revoked, replacement };
      });
    },
  };
}
