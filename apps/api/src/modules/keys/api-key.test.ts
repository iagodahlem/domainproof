import { createHash, randomUUID } from "node:crypto";
import { generateToken } from "@domainproof/core";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApiKeyAuthMiddleware, type ApiKeyAuthVariables } from "./api-key";
import { generateKeyId } from "./domain/encoding";
import { formatApiKey, type ApiKeyMode } from "./domain/parse";
import type { ApiKeyRow, KeysRepository } from "./repository";

/**
 * A fake KeysRepository implementing the port directly, in memory — no
 * real db, no real key creation via the service. Only `findByKeyId`,
 * `revoke`, and `touchLastUsed` are exercised here, which is all this
 * middleware calls; the repository's own persistence behavior is covered
 * by repository.test.ts.
 */
function fakeRepository(seedRows: ApiKeyRow[]): KeysRepository & { touchedIds: string[] } {
  const rows = new Map(seedRows.map((row) => [row.keyId, row]));
  const touchedIds: string[] = [];

  return {
    touchedIds,
    async insert() {
      throw new Error("not used by this middleware");
    },
    async listByProject() {
      throw new Error("not used by this middleware");
    },
    async revoke(projectId, keyId) {
      const row = rows.get(keyId);
      if (!row || row.projectId !== projectId) return undefined;
      const updated = { ...row, revokedAt: new Date() };
      rows.set(keyId, updated);
      return updated;
    },
    async findByKeyId(keyId) {
      return rows.get(keyId);
    },
    async touchLastUsed(id) {
      touchedIds.push(id);
    },
    async rotate() {
      throw new Error("not used by this middleware");
    },
  };
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function makeKeyRow(mode: ApiKeyMode = "live"): { row: ApiKeyRow; key: string } {
  const keyId = generateKeyId();
  const secret = generateToken();
  const key = formatApiKey({ mode, keyId, secret });
  const row: ApiKeyRow = {
    id: randomUUID(),
    projectId: "project_1",
    mode,
    keyId,
    secretHash: hashSecret(secret),
    last4: secret.slice(-4),
    name: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
  };
  return { row, key };
}

function buildApp(repository: KeysRepository) {
  const app = new Hono<{ Variables: ApiKeyAuthVariables }>();
  app.get("/protected", createApiKeyAuthMiddleware(repository), (c) => {
    return c.json({
      projectId: c.get("projectId"),
      mode: c.get("mode"),
      keyId: c.get("keyId"),
    });
  });
  return app;
}

async function authedRequest(
  app: ReturnType<typeof buildApp>,
  bearer: string | undefined,
) {
  return app.request("/protected", {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
}

describe("createApiKeyAuthMiddleware", () => {
  it("accepts a valid key, sets project/mode/keyId, and touches last-used", async () => {
    const { row, key } = makeKeyRow("live");
    const repository = fakeRepository([row]);
    const app = buildApp(repository);

    const res = await authedRequest(app, key);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiKeyAuthVariables;
    expect(body.projectId).toBe(row.projectId);
    expect(body.mode).toBe("live");
    expect(body.keyId).toBe(row.keyId);
    expect(repository.touchedIds).toContain(row.id);
  });

  it("rejects a missing Authorization header", async () => {
    const app = buildApp(fakeRepository([]));
    const res = await authedRequest(app, undefined);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_api_key");
  });

  it("rejects a malformed key with the same code/body as an unknown key", async () => {
    const app = buildApp(fakeRepository([]));

    const malformed = await authedRequest(app, "not-a-real-key");
    const unknown = await authedRequest(
      app,
      "dp_live_000000000000_aaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    expect(malformed.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await malformed.json()).toEqual(await unknown.json());
  });

  it("rejects the right key id with the wrong secret, identically to an unknown key id", async () => {
    const { row, key } = makeKeyRow("test");
    const app = buildApp(fakeRepository([row]));

    // Same key id, tampered secret.
    const [, mode, keyId] = key.split("_");
    const wrongSecretKey = `dp_${mode}_${keyId}_${"z".repeat(26)}`;

    const wrongSecretRes = await authedRequest(app, wrongSecretKey);
    const unknownRes = await authedRequest(
      app,
      "dp_test_000000000000_aaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    expect(wrongSecretRes.status).toBe(401);
    expect(unknownRes.status).toBe(401);
    expect(await wrongSecretRes.json()).toEqual(await unknownRes.json());
  });

  it("rejects a revoked key with 401 after previously accepting it", async () => {
    const { row, key } = makeKeyRow("test");
    const repository = fakeRepository([row]);
    const app = buildApp(repository);

    expect((await authedRequest(app, key)).status).toBe(200);

    await repository.revoke(row.projectId, row.keyId);

    const res = await authedRequest(app, key);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_api_key");
  });

  it("rejects a key presented with the wrong mode segment", async () => {
    const { row, key } = makeKeyRow("live");
    const app = buildApp(fakeRepository([row]));

    const [, , keyId, secret] = key.split("_");
    const wrongModeKey = `dp_test_${keyId}_${secret}`;

    const res = await authedRequest(app, wrongModeKey);
    expect(res.status).toBe(401);
  });
});
