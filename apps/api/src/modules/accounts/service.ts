import type { AccountsRepository } from "./repository";

export interface EnsureAccountResult {
  accountId: string;
  /** True only when this call created the account (and its default project). */
  created: boolean;
}

export interface AccountsService {
  /**
   * Gets or creates the account for a verified Clerk user id, creating a
   * "Default" project the first time the account is created.
   *
   * Upsert semantics via the repository's insert-with-conflict-handling,
   * not a check-then-insert: two requests racing to bootstrap the same
   * brand-new user can both call this concurrently — exactly one create
   * succeeds, and the loser re-reads the winner's row instead of throwing
   * or double-creating a project.
   */
  ensureAccount(clerkUserId: string): Promise<EnsureAccountResult>;
}

export function createAccountsService(repository: AccountsRepository): AccountsService {
  return {
    async ensureAccount(clerkUserId) {
      const created = await repository.createWithDefaultProject(clerkUserId);
      if (created) {
        return { accountId: created.id, created: true };
      }

      const existing = await repository.findByClerkUserId(clerkUserId);
      if (!existing) {
        // The insert hit the unique conflict (so a row exists) but the
        // re-select didn't find it — should not happen outside of a
        // visibility race inside a broken transaction setup.
        throw new Error(
          `Failed to bootstrap account for clerk user ${clerkUserId}: row not found after conflict`,
        );
      }

      return { accountId: existing.id, created: false };
    },
  };
}
