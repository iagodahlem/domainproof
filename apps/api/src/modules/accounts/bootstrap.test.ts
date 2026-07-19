import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../infra/db/client";
import { accounts, projects } from "../../infra/db/schema";
import { bootstrapAccount } from "./bootstrap";

// These tests run against the postgres service defined in the repo's
// compose.yaml (started with `docker compose up -d db` and migrated with
// `pnpm --filter api db:migrate`) rather than mocking the db layer, so the
// ON CONFLICT DO NOTHING + re-select concurrency behavior is exercised
// against a real unique constraint instead of a stubbed one.
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

describe("bootstrapAccount", () => {
  it("creates an account and a default project for a new clerk user", async () => {
    const clerkUserId = freshClerkUserId();

    const result = await bootstrapAccount(db, clerkUserId);

    expect(result.created).toBe(true);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.clerkUserId, clerkUserId));
    expect(account?.id).toBe(result.accountId);

    const projectRows = await db
      .select()
      .from(projects)
      .where(eq(projects.accountId, result.accountId));
    expect(projectRows).toHaveLength(1);
    expect(projectRows[0]?.name).toBe("Default");
  });

  it("returns the existing account without creating a second project", async () => {
    const clerkUserId = freshClerkUserId();

    const first = await bootstrapAccount(db, clerkUserId);
    const second = await bootstrapAccount(db, clerkUserId);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.accountId).toBe(first.accountId);

    const projectRows = await db
      .select()
      .from(projects)
      .where(eq(projects.accountId, first.accountId));
    expect(projectRows).toHaveLength(1);
  });

  it("is safe under concurrent bootstrap calls for the same user", async () => {
    const clerkUserId = freshClerkUserId();

    const [a, b, c] = await Promise.all([
      bootstrapAccount(db, clerkUserId),
      bootstrapAccount(db, clerkUserId),
      bootstrapAccount(db, clerkUserId),
    ]);

    const accountIds = new Set([a.accountId, b.accountId, c.accountId]);
    expect(accountIds.size).toBe(1);
    expect([a.created, b.created, c.created].filter(Boolean)).toHaveLength(1);

    const projectRows = await db
      .select()
      .from(projects)
      .where(eq(projects.accountId, a.accountId));
    expect(projectRows).toHaveLength(1);
  });
});
