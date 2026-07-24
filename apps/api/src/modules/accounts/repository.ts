import { eq } from 'drizzle-orm'
import type { Database } from '@infra/db/client'
import { accounts, projects } from '@infra/db/schema'

/** A newly (or already) bootstrapped account's id and email. */
export interface AccountRow {
  id: string
  email: string | null
}

/**
 * All db access for the accounts module. This is the only file in
 * `modules/accounts` allowed to import `@infra/db` — `service.ts` and
 * everything above it depend on this interface, never on the schema or a
 * `Database` directly.
 */
export interface AccountsRepository {
  findByClerkUserId(clerkUserId: string): Promise<AccountRow | undefined>

  /**
   * Inserts an account row (with the given email, if any). Returns
   * `undefined` (rather than throwing) when `clerkUserId` already has an
   * account: the insert hits `clerk_user_id`'s unique constraint via `ON
   * CONFLICT DO NOTHING`, which is what makes two concurrent callers for
   * the same brand-new user safe — exactly one insert succeeds, the other
   * gets `undefined` and falls back to {@link findByClerkUserId} instead
   * of erroring.
   */
  create(
    clerkUserId: string,
    email: string | null,
  ): Promise<AccountRow | undefined>

  /**
   * The email of the account that owns `projectId`, for the notifications
   * module to address a domain-event email to — a project always belongs
   * to exactly one account. `undefined` covers both "no such project" and
   * "the account has no email on file"; the caller (see
   * `modules/notifications/service.ts`) treats both the same way: skip
   * the send, log why.
   */
  findEmailByProjectId(projectId: string): Promise<string | undefined>

  /**
   * Sets `accountId`'s email — used only to backfill an account that
   * bootstrapped with no email (see `service.ts`'s `ensureAccount`), never
   * to overwrite one that already has an email. Unconditional at this
   * layer: the fill-when-empty rule is the caller's job, not this method's.
   */
  updateEmail(accountId: string, email: string): Promise<void>
}

export function createAccountsRepository(db: Database): AccountsRepository {
  return {
    async findByClerkUserId(clerkUserId) {
      const [row] = await db
        .select({ id: accounts.id, email: accounts.email })
        .from(accounts)
        .where(eq(accounts.clerkUserId, clerkUserId))
        .limit(1)
      return row
    },

    async create(clerkUserId, email) {
      const [account] = await db
        .insert(accounts)
        .values({ clerkUserId, email })
        .onConflictDoNothing({ target: accounts.clerkUserId })
        .returning({ id: accounts.id, email: accounts.email })

      return account
    },

    async findEmailByProjectId(projectId) {
      const [row] = await db
        .select({ email: accounts.email })
        .from(accounts)
        .innerJoin(projects, eq(projects.accountId, accounts.id))
        .where(eq(projects.id, projectId))
        .limit(1)
      return row?.email ?? undefined
    },

    async updateEmail(accountId, email) {
      await db.update(accounts).set({ email }).where(eq(accounts.id, accountId))
    },
  }
}
