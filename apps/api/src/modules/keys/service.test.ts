import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ApiKeyInsert, ApiKeyMaterial, ApiKeyRow, KeysRepository, RotateResult } from "./repository";
import { parseApiKey } from "./domain/parse";
import { createKeysService } from "./service";

/**
 * A fake KeysRepository implementing the port directly, in memory — no
 * real db. The repository's own persistence behavior (constraints,
 * transactions, cross-project scoping) is covered by repository.test.ts
 * against a real db; this file only tests the service's own logic: secret
 * generation, hashing, masking, and what rotate carries over from the
 * existing key.
 */
function fakeRepository(): KeysRepository {
  const rows = new Map<string, ApiKeyRow>();

  function toRow(id: string, values: ApiKeyInsert): ApiKeyRow {
    return {
      id,
      projectId: values.projectId,
      mode: values.mode,
      keyId: values.keyId,
      secretHash: values.secretHash,
      last4: values.last4,
      name: values.name,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
    };
  }

  return {
    async insert(values) {
      const row = toRow(randomUUID(), values);
      rows.set(row.id, row);
      return row;
    },
    async listByProject(projectId) {
      return [...rows.values()].filter((row) => row.projectId === projectId);
    },
    async revoke(projectId, keyId) {
      const row = [...rows.values()].find((r) => r.projectId === projectId && r.keyId === keyId);
      if (!row) return undefined;
      const updated = { ...row, revokedAt: new Date() };
      rows.set(row.id, updated);
      return updated;
    },
    async findByKeyId(keyId) {
      return [...rows.values()].find((r) => r.keyId === keyId);
    },
    async touchLastUsed(id) {
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, lastUsedAt: new Date() });
    },
    async rotate(
      projectId: string,
      keyId: string,
      newKeyMaterial: ApiKeyMaterial,
    ): Promise<RotateResult | undefined> {
      const existing = [...rows.values()].find(
        (r) => r.projectId === projectId && r.keyId === keyId,
      );
      if (!existing) return undefined;
      const revoked = { ...existing, revokedAt: existing.revokedAt ?? new Date() };
      rows.set(existing.id, revoked);
      const replacement = toRow(randomUUID(), {
        projectId,
        mode: existing.mode,
        keyId: newKeyMaterial.keyId,
        secretHash: newKeyMaterial.secretHash,
        last4: newKeyMaterial.last4,
        name: existing.name,
      });
      rows.set(replacement.id, replacement);
      return { previous: revoked, replacement };
    },
  };
}

describe("createKey", () => {
  it("returns a parseable key and a display-safe row with no secret material", async () => {
    const service = createKeysService(fakeRepository());

    const result = await service.createKey("project_1", "live", "CI key");

    const parsed = parseApiKey(result.key);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.mode).toBe("live");
      expect(parsed.value.keyId).toBe(result.apiKey.keyId);
    }

    expect(result.apiKey.name).toBe("CI key");
    expect(result.apiKey.revokedAt).toBeNull();
    expect(result.apiKey.mode).toBe("live");
    expect(result.apiKey.maskedKey).not.toContain(parsed.ok ? parsed.value.secret : "");
    expect(Object.keys(result.apiKey)).not.toContain("secretHash");
  });

  it("defaults name to null when omitted", async () => {
    const service = createKeysService(fakeRepository());
    const result = await service.createKey("project_1", "test");
    expect(result.apiKey.name).toBeNull();
  });
});

describe("listKeys", () => {
  it("never includes hashes or full keys", async () => {
    const service = createKeysService(fakeRepository());
    await service.createKey("project_1", "test", "first");
    await service.createKey("project_1", "live", "second");

    const items = await service.listKeys("project_1");
    expect(items).toHaveLength(2);

    for (const item of items) {
      const serialized = JSON.stringify(item);
      expect(serialized).not.toContain("secretHash");
      // maskedKey must never contain a 26-char secret run.
      expect(item.maskedKey).not.toMatch(/[a-z2-7]{26}/);
    }
  });

  it("only returns keys for the given project", async () => {
    const service = createKeysService(fakeRepository());
    await service.createKey("project_a", "test");
    await service.createKey("project_b", "test");

    expect(await service.listKeys("project_a")).toHaveLength(1);
    expect(await service.listKeys("project_b")).toHaveLength(1);
  });
});

describe("revokeKey", () => {
  it("sets revokedAt and returns the updated item", async () => {
    const service = createKeysService(fakeRepository());
    const created = await service.createKey("project_1", "test");

    const revoked = await service.revokeKey("project_1", created.apiKey.keyId);
    expect(revoked?.revokedAt).toBeInstanceOf(Date);
  });

  it("returns null for a key id that doesn't belong to the project", async () => {
    const service = createKeysService(fakeRepository());
    const created = await service.createKey("project_a", "test");

    expect(await service.revokeKey("project_b", created.apiKey.keyId)).toBeNull();
  });

  it("returns null for an unknown key id", async () => {
    const service = createKeysService(fakeRepository());
    expect(await service.revokeKey("project_1", "doesnotexist1")).toBeNull();
  });
});

describe("rotateKey", () => {
  it("revokes the old key and returns a new working one with the same name and mode", async () => {
    const service = createKeysService(fakeRepository());
    const original = await service.createKey("project_1", "live", "Rotate me");

    const rotated = await service.rotateKey("project_1", original.apiKey.keyId);
    expect(rotated).not.toBeNull();
    if (!rotated) return;

    expect(rotated.apiKey.name).toBe("Rotate me");
    expect(rotated.apiKey.mode).toBe("live");
    expect(rotated.apiKey.keyId).not.toBe(original.apiKey.keyId);

    const parsedNewKey = parseApiKey(rotated.key);
    expect(parsedNewKey.ok).toBe(true);

    const items = await service.listKeys("project_1");
    const oldItem = items.find((i) => i.keyId === original.apiKey.keyId);
    const newItem = items.find((i) => i.keyId === rotated.apiKey.keyId);
    expect(oldItem?.revokedAt).not.toBeNull();
    expect(newItem?.revokedAt).toBeNull();
  });

  it("returns null for a key id that doesn't belong to the project", async () => {
    const service = createKeysService(fakeRepository());
    const created = await service.createKey("project_a", "test");

    expect(await service.rotateKey("project_b", created.apiKey.keyId)).toBeNull();
  });
});
