import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb, type Database } from "@infra/db/client";
import { accounts, projects } from "@infra/db/schema";
import { createProjectsRepository } from "./repository";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://domainproof:domainproof@localhost:5432/domainproof";

const db: Database = createDb(DATABASE_URL);
const repository = createProjectsRepository(db);
const createdClerkUserIds: string[] = [];

async function createTestAccount(): Promise<string> {
  const clerkUserId = `user_${randomUUID()}`;
  createdClerkUserIds.push(clerkUserId);

  const [account] = await db
    .insert(accounts)
    .values({ clerkUserId })
    .returning({ id: accounts.id });
  if (!account) throw new Error("failed to create test account");
  return account.id;
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop();
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId));
    }
  }
});

describe("findDefaultProjectId", () => {
  it("returns undefined for an account with no project", async () => {
    const accountId = await createTestAccount();
    expect(await repository.findDefaultProjectId(accountId)).toBeUndefined();
  });

  it("returns the project id for an account with a project", async () => {
    const accountId = await createTestAccount();
    const [project] = await db
      .insert(projects)
      .values({ accountId, name: "Default" })
      .returning({ id: projects.id });

    expect(await repository.findDefaultProjectId(accountId)).toBe(project?.id);
  });
});
