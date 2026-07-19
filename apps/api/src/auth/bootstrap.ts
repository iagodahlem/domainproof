import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { accounts, projects } from "../db/schema.js";

export interface BootstrapResult {
  accountId: string;
  /** True only when this call created the account (and its default project). */
  created: boolean;
}

/**
 * Gets or creates the account row for a verified Clerk user id, creating a
 * "Default" project the first time the account is created.
 *
 * Concurrency-safe by construction: this relies on `clerk_user_id`'s unique
 * constraint plus `ON CONFLICT DO NOTHING` followed by a re-select, not a
 * check-then-insert. Two requests racing to bootstrap the same brand-new
 * user can both run this concurrently — exactly one insert succeeds, and
 * the loser reads back the winner's row instead of throwing or double
 * creating a project.
 *
 * The account insert and its default-project insert happen inside a
 * single transaction: if the process crashes (or the project insert
 * fails) between the two, the transaction rolls back rather than leaving
 * an account row with no default project behind.
 */
export async function bootstrapAccount(
  db: Database,
  clerkUserId: string,
): Promise<BootstrapResult> {
  const insertedAccountId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(accounts)
      .values({ clerkUserId })
      .onConflictDoNothing({ target: accounts.clerkUserId })
      .returning({ id: accounts.id });

    const insertedAccount = inserted[0];
    if (!insertedAccount) {
      return null;
    }

    await tx.insert(projects).values({
      accountId: insertedAccount.id,
      name: "Default",
    });

    return insertedAccount.id;
  });

  if (insertedAccountId) {
    return { accountId: insertedAccountId, created: true };
  }

  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.clerkUserId, clerkUserId))
    .limit(1);

  if (!existing) {
    // The insert hit the unique conflict (so a row exists) but the
    // re-select didn't find it — should not happen outside of a
    // visibility race inside a broken transaction setup.
    throw new Error(
      `Failed to bootstrap account for clerk user ${clerkUserId}: row not found after conflict`,
    );
  }

  return { accountId: existing.id, created: false };
}
