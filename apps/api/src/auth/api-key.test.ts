import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { createDb, type Database } from "../db/client.js";
import { accounts, projects } from "../db/schema.js";
import { createKey, revokeKey } from "../keys/service.js";
import { createApiKeyAuthMiddleware, type ApiKeyAuthVariables } from "./api-key.js";

// Runs against the real local Postgres, following the same pattern as
// auth/bootstrap.test.ts.
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://domainproof:domainproof@localhost:5432/domainproof";

const db: Database = createDb(DATABASE_URL);
const createdClerkUserIds: string[] = [];

async function createTestProject(): Promise<string> {
  const clerkUserId = `user_${randomUUID()}`;
  createdClerkUserIds.push(clerkUserId);

  const [account] = await db
    .insert(accounts)
    .values({ clerkUserId })
    .returning({ id: accounts.id });
  if (!account) throw new Error("failed to create test account");

  const [project] = await db
    .insert(projects)
    .values({ accountId: account.id, name: "Test project" })
    .returning({ id: projects.id });
  if (!project) throw new Error("failed to create test project");

  return project.id;
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop();
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId));
    }
  }
});

function buildApp() {
  const app = new Hono<{ Variables: ApiKeyAuthVariables }>();
  app.get("/protected", createApiKeyAuthMiddleware(db), (c) => {
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
  it("accepts a freshly created key and sets project/mode/keyId", async () => {
    const projectId = await createTestProject();
    const created = await createKey(db, projectId, "live");
    const app = buildApp();

    const res = await authedRequest(app, created.key);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiKeyAuthVariables;
    expect(body.projectId).toBe(projectId);
    expect(body.mode).toBe("live");
    expect(body.keyId).toBe(created.apiKey.keyId);
  });

  it("rejects a missing Authorization header", async () => {
    const app = buildApp();
    const res = await authedRequest(app, undefined);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_api_key");
  });

  it("rejects a malformed key with the same code/body as an unknown key", async () => {
    const app = buildApp();

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
    const projectId = await createTestProject();
    const created = await createKey(db, projectId, "test");
    const app = buildApp();

    // Same key id, tampered secret.
    const [, mode, keyId] = created.key.split("_");
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
    const projectId = await createTestProject();
    const created = await createKey(db, projectId, "test");
    const app = buildApp();

    expect((await authedRequest(app, created.key)).status).toBe(200);

    await revokeKey(db, projectId, created.apiKey.keyId);

    const res = await authedRequest(app, created.key);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_api_key");
  });

  it("rejects a key presented with the wrong mode segment", async () => {
    const projectId = await createTestProject();
    const created = await createKey(db, projectId, "live");
    const app = buildApp();

    const [, , keyId, secret] = created.key.split("_");
    const wrongModeKey = `dp_test_${keyId}_${secret}`;

    const res = await authedRequest(app, wrongModeKey);
    expect(res.status).toBe(401);
  });
});
