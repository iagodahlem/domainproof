import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../infra/db/client";
import { accounts, apiKeys, projects } from "../../infra/db/schema";
import { parseApiKey } from "./parse";
import { createKey, listKeys, revokeKey, rotateKey } from "./service";

// Runs against the postgres service defined in the repo's compose.yaml
// (started with `docker compose up -d db`, migrated with
// `pnpm --filter api db:migrate`), following the same real-db pattern as
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

describe("createKey", () => {
  it("returns a parseable key and a display-safe row with no secret material", async () => {
    const projectId = await createTestProject();

    const result = await createKey(db, projectId, "live", "CI key");

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

    const [row] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyId, result.apiKey.keyId));
    expect(row?.secretHash).toBeTruthy();
    expect(row?.last4).toBe(result.key.slice(-4));
  });

  it("defaults name to null when omitted", async () => {
    const projectId = await createTestProject();
    const result = await createKey(db, projectId, "test");
    expect(result.apiKey.name).toBeNull();
  });
});

describe("listKeys", () => {
  it("never includes hashes or full keys", async () => {
    const projectId = await createTestProject();
    await createKey(db, projectId, "test", "first");
    await createKey(db, projectId, "live", "second");

    const items = await listKeys(db, projectId);
    expect(items).toHaveLength(2);

    for (const item of items) {
      const serialized = JSON.stringify(item);
      expect(serialized).not.toContain("secretHash");
      // maskedKey must never contain a 26-char secret run.
      expect(item.maskedKey).not.toMatch(/[a-z2-7]{26}/);
    }
  });

  it("only returns keys for the given project", async () => {
    const projectA = await createTestProject();
    const projectB = await createTestProject();

    await createKey(db, projectA, "test");
    await createKey(db, projectB, "test");

    expect(await listKeys(db, projectA)).toHaveLength(1);
    expect(await listKeys(db, projectB)).toHaveLength(1);
  });
});

describe("revokeKey", () => {
  it("sets revokedAt and returns the updated row", async () => {
    const projectId = await createTestProject();
    const created = await createKey(db, projectId, "test");

    const revoked = await revokeKey(db, projectId, created.apiKey.keyId);
    expect(revoked?.revokedAt).toBeInstanceOf(Date);
  });

  it("returns null for a key id that doesn't belong to the project", async () => {
    const projectA = await createTestProject();
    const projectB = await createTestProject();
    const created = await createKey(db, projectA, "test");

    const result = await revokeKey(db, projectB, created.apiKey.keyId);
    expect(result).toBeNull();
  });

  it("returns null for an unknown key id", async () => {
    const projectId = await createTestProject();
    const result = await revokeKey(db, projectId, "doesnotexist1");
    expect(result).toBeNull();
  });
});

describe("rotateKey", () => {
  it("revokes the old key and returns a new working one with the same name", async () => {
    const projectId = await createTestProject();
    const original = await createKey(db, projectId, "live", "Rotate me");

    const rotated = await rotateKey(db, projectId, original.apiKey.keyId);
    expect(rotated).not.toBeNull();
    if (!rotated) return;

    expect(rotated.apiKey.name).toBe("Rotate me");
    expect(rotated.apiKey.mode).toBe("live");
    expect(rotated.apiKey.keyId).not.toBe(original.apiKey.keyId);

    const [oldRow] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyId, original.apiKey.keyId));
    expect(oldRow?.revokedAt).toBeInstanceOf(Date);

    const [newRow] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyId, rotated.apiKey.keyId));
    expect(newRow?.revokedAt).toBeNull();

    const parsedNewKey = parseApiKey(rotated.key);
    expect(parsedNewKey.ok).toBe(true);
  });

  it("returns null for a key id that doesn't belong to the project", async () => {
    const projectA = await createTestProject();
    const projectB = await createTestProject();
    const created = await createKey(db, projectA, "test");

    const result = await rotateKey(db, projectB, created.apiKey.keyId);
    expect(result).toBeNull();
  });
});
