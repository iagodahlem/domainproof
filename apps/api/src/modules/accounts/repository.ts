import { eq } from 'drizzle-orm'
import type { Database } from '@infra/db/client'
import { accounts, projects } from '@infra/db/schema'
import { deriveProjectSlug } from '@modules/projects/domain/brand'

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
   * Inserts an account row (with the given email, if any) plus its
   * "Default" project, atomically, in one transaction — the project
   * insert only happens if the account insert actually landed. Returns
   * `undefined` (rather than throwing) when `clerkUserId` already has an
   * account: the insert hits `clerk_user_id`'s unique constraint via `ON
   * CONFLICT DO NOTHING`, which is what makes two concurrent callers for
   * the same brand-new user safe — exactly one insert succeeds, the other
   * gets `undefined` and falls back to {@link findByClerkUserId} instead
   * of erroring or double-creating a project.
   */
  createWithDefaultProject(
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

    async createWithDefaultProject(clerkUserId, email) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(accounts)
          .values({ clerkUserId, email })
          .onConflictDoNothing({ target: accounts.clerkUserId })
          .returning({ id: accounts.id, email: accounts.email })

        const account = inserted[0]
        if (!account) {
          return undefined
        }

        await tx.insert(projects).values({
          accountId: account.id,
          name: 'Default',
          slug: deriveProjectSlug('Default'),
        })

        return account
      })
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
  }
}
