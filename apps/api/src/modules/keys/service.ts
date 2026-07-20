import { createHash } from "node:crypto";
import { generateToken } from "@domainproof/core";
import type { ApiKeyRow, KeysRepository } from "./repository";
import { generateKeyId } from "./domain/encoding";
import { formatApiKey, type ApiKeyMode } from "./domain/parse";

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

export interface KeysService {
  /**
   * Creates a new API key for a project. The full key (including the
   * secret) is returned exactly once, in this response — only its SHA-256
   * hash and last4 are persisted, so there is no way to recover it later,
   * by design.
   */
  createKey(projectId: string, mode: ApiKeyMode, name?: string): Promise<CreateKeyResult>;

  /** Lists all keys (any mode, any status) belonging to a project. Never returns hashes or secrets. */
  listKeys(projectId: string): Promise<ApiKeyListItem[]>;

  /** Revokes a key. Returns `null` if `keyId` doesn't belong to `projectId`. */
  revokeKey(projectId: string, keyId: string): Promise<ApiKeyListItem | null>;

  /**
   * Rotates a key: revokes the existing key and creates a replacement
   * with the same name and mode, returning the replacement's one-time
   * full key. Returns `null` if no key with `keyId` exists under
   * `projectId` (the caller should surface this as a 404, matching the
   * anti-enumeration stance used elsewhere in the key lifecycle).
   */
  rotateKey(projectId: string, keyId: string): Promise<CreateKeyResult | null>;
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

export function createKeysService(repository: KeysRepository): KeysService {
  return {
    async createKey(projectId, mode, name) {
      const keyId = generateKeyId();
      const secret = generateToken();
      const key = formatApiKey({ mode, keyId, secret });

      const row = await repository.insert({
        projectId,
        mode,
        keyId,
        secretHash: hashSecret(secret),
        last4: secret.slice(-4),
        name: name ?? null,
      });

      return { key, apiKey: toListItem(row) };
    },

    async listKeys(projectId) {
      const rows = await repository.listByProject(projectId);
      return rows.map(toListItem);
    },

    async revokeKey(projectId, keyId) {
      const row = await repository.revoke(projectId, keyId);
      return row ? toListItem(row) : null;
    },

    async rotateKey(projectId, keyId) {
      const newKeyId = generateKeyId();
      const secret = generateToken();

      const result = await repository.rotate(projectId, keyId, {
        keyId: newKeyId,
        secretHash: hashSecret(secret),
        last4: secret.slice(-4),
      });
      if (!result) {
        return null;
      }

      const key = formatApiKey({ mode: result.replacement.mode, keyId: newKeyId, secret });
      return { key, apiKey: toListItem(result.replacement) };
    },
  };
}
