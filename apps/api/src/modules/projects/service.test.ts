import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb, type Database } from "@infra/db/client";
import { accounts, projects } from "@infra/db/schema";
import { getDefaultProjectId } from "./service";

// Runs against the postgres service defined in the repo's compose.yaml
// (started with `docker compose up -d db`, migrated with
// `pnpm --filter api db:migrate`), following the same real-db pattern as
// accounts/bootstrap.test.ts and keys/service.test.ts.
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://domainproof:domainproof@localhost:5432/domainproof";

const db: Database = createDb(DATABASE_URL);
const createdClerkUserIds: string[] = [];

function freshClerkUserId() {
  const id = `user_${randomUUID()}`;
  createdClerkUserIds.push(id);
  return id;
}

afterEach(async () => {
  while (createdClerkUserIds.length > 0) {
    const clerkUserId = createdClerkUserIds.pop();
    if (clerkUserId) {
      await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId));
    }
  }
});

describe("getDefaultProjectId", () => {
  it("bootstraps a new account and returns its default project id", async () => {
    const clerkUserId = freshClerkUserId();

    const projectId = await getDefaultProjectId(db, clerkUserId);

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    expect(project?.name).toBe("Default");

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.clerkUserId, clerkUserId));
    expect(project?.accountId).toBe(account?.id);
  });

  it("returns the same project id on repeated calls for the same user", async () => {
    const clerkUserId = freshClerkUserId();

    const first = await getDefaultProjectId(db, clerkUserId);
    const second = await getDefaultProjectId(db, clerkUserId);

    expect(second).toBe(first);
  });
});
