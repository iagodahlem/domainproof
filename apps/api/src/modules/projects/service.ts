import { eq } from "drizzle-orm";
import { bootstrapAccount } from "../accounts/bootstrap";
import type { Database } from "../../infra/db/client";
import { projects } from "../../infra/db/schema";

/**
 * Resolves the project a Clerk-authenticated caller is acting on,
 * bootstrapping their account (and its default project) on first call.
 *
 * Every account currently has exactly one ("Default") project — created
 * atomically alongside the account in {@link bootstrapAccount} — so this
 * is a stand-in for real project selection until the dashboard supports
 * multiple projects per account.
 */
export async function getDefaultProjectId(
  db: Database,
  clerkUserId: string,
): Promise<string> {
  const { accountId } = await bootstrapAccount(db, clerkUserId);

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.accountId, accountId))
    .limit(1);

  if (!project) {
    // Cannot happen: bootstrapAccount guarantees a default project exists
    // for every account (created atomically in the same transaction).
    throw new Error(`No project found for account ${accountId}`);
  }

  return project.id;
}
