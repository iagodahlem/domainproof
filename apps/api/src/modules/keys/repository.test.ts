import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb, type Database } from "@infra/db/client";
import { accounts, projects } from "@infra/db/schema";
import { createKeysRepository } from "./repository";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://domainproof:domainproof@localhost:5432/domainproof";

const db: Database = createDb(DATABASE_URL);
const repository = createKeysRepository(db);
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

function material(suffix: string) {
  return {
    keyId: `key${suffix}______`.slice(0, 12),
    secretHash: `hash-${suffix}`,
    last4: suffix.slice(-4).padStart(4, "0"),
  };
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop();
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId));
    }
  }
});

describe("insert", () => {
  it("persists a row with the given values", async () => {
    const projectId = await createTestProject();
    const row = await repository.insert({
      projectId,
      mode: "live",
      name: "CI key",
      ...material("1"),
    });

    expect(row.projectId).toBe(projectId);
    expect(row.mode).toBe("live");
    expect(row.name).toBe("CI key");
    expect(row.revokedAt).toBeNull();
  });
});

describe("listByProject", () => {
  it("only returns keys for the given project", async () => {
    const projectA = await createTestProject();
    const projectB = await createTestProject();

    await repository.insert({ projectId: projectA, mode: "test", name: null, ...material("1") });
    await repository.insert({ projectId: projectB, mode: "test", name: null, ...material("2") });

    expect(await repository.listByProject(projectA)).toHaveLength(1);
    expect(await repository.listByProject(projectB)).toHaveLength(1);
  });
});

describe("revoke", () => {
  it("sets revokedAt and returns the updated row", async () => {
    const projectId = await createTestProject();
    const created = await repository.insert({
      projectId,
      mode: "test",
      name: null,
      ...material("1"),
    });

    const revoked = await repository.revoke(projectId, created.keyId);
    expect(revoked?.revokedAt).toBeInstanceOf(Date);
  });

  it("returns undefined for a key id that doesn't belong to the project", async () => {
    const projectA = await createTestProject();
    const projectB = await createTestProject();
    const created = await repository.insert({
      projectId: projectA,
      mode: "test",
      name: null,
      ...material("1"),
    });

    expect(await repository.revoke(projectB, created.keyId)).toBeUndefined();
  });
});

describe("findByKeyId", () => {
  it("finds a key by id regardless of project", async () => {
    const projectId = await createTestProject();
    const created = await repository.insert({
      projectId,
      mode: "test",
      name: null,
      ...material("1"),
    });

    const found = await repository.findByKeyId(created.keyId);
    expect(found?.id).toBe(created.id);
  });

  it("returns undefined for an unknown key id", async () => {
    expect(await repository.findByKeyId("doesnotexist1")).toBeUndefined();
  });
});

describe("touchLastUsed", () => {
  it("sets lastUsedAt", async () => {
    const projectId = await createTestProject();
    const created = await repository.insert({
      projectId,
      mode: "test",
      name: null,
      ...material("1"),
    });
    expect(created.lastUsedAt).toBeNull();

    await repository.touchLastUsed(created.id);

    const found = await repository.findByKeyId(created.keyId);
    expect(found?.lastUsedAt).toBeInstanceOf(Date);
  });
});

describe("rotate", () => {
  it("revokes the old key and inserts a replacement with the same mode and name", async () => {
    const projectId = await createTestProject();
    const original = await repository.insert({
      projectId,
      mode: "live",
      name: "Rotate me",
      ...material("1"),
    });

    const result = await repository.rotate(projectId, original.keyId, material("2"));
    expect(result).toBeDefined();
    if (!result) return;

    expect(result.previous.id).toBe(original.id);
    expect(result.previous.revokedAt).toBeInstanceOf(Date);
    expect(result.replacement.mode).toBe("live");
    expect(result.replacement.name).toBe("Rotate me");
    expect(result.replacement.keyId).not.toBe(original.keyId);
    expect(result.replacement.revokedAt).toBeNull();
  });

  it("returns undefined for a key id that doesn't belong to the project", async () => {
    const projectA = await createTestProject();
    const projectB = await createTestProject();
    const created = await repository.insert({
      projectId: projectA,
      mode: "test",
      name: null,
      ...material("1"),
    });

    expect(await repository.rotate(projectB, created.keyId, material("2"))).toBeUndefined();
  });
});
