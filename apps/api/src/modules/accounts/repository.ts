import { eq } from "drizzle-orm";
import type { Database } from "@infra/db/client";
import { accounts, projects } from "@infra/db/schema";

/** A newly (or already) bootstrapped account's id. */
export interface AccountRow {
  id: string;
}

/**
 * All db access for the accounts module. This is the only file in
 * `modules/accounts` allowed to import `@infra/db` — `service.ts` and
 * everything above it depend on this interface, never on the schema or a
 * `Database` directly.
 */
export interface AccountsRepository {
  findByClerkUserId(clerkUserId: string): Promise<AccountRow | undefined>;

  /**
   * Inserts an account row plus its "Default" project, atomically, in one
   * transaction — the project insert only happens if the account insert
   * actually landed. Returns `undefined` (rather than throwing) when
   * `clerkUserId` already has an account: the insert hits
   * `clerk_user_id`'s unique constraint via `ON CONFLICT DO NOTHING`,
   * which is what makes two concurrent callers for the same brand-new user
   * safe — exactly one insert succeeds, the other gets `undefined` and
   * falls back to {@link findByClerkUserId} instead of erroring or
   * double-creating a project.
   */
  createWithDefaultProject(clerkUserId: string): Promise<AccountRow | undefined>;
}

export function createAccountsRepository(db: Database): AccountsRepository {
  return {
    async findByClerkUserId(clerkUserId) {
      const [row] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.clerkUserId, clerkUserId))
        .limit(1);
      return row;
    },

    async createWithDefaultProject(clerkUserId) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(accounts)
          .values({ clerkUserId })
          .onConflictDoNothing({ target: accounts.clerkUserId })
          .returning({ id: accounts.id });

        const account = inserted[0];
        if (!account) {
          return undefined;
        }

        await tx.insert(projects).values({
          accountId: account.id,
          name: "Default",
        });

        return account;
      });
    },
  };
}
