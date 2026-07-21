import type { EventBus } from '@shared/events'
import type { AccountEmailResolver } from './ports'
import type { AccountsRepository } from './repository'

export interface EnsureAccountResult {
  accountId: string
  /** True only when this call created the account. */
  created: boolean
  email: string | null
}

export interface AccountsService {
  /**
   * Gets or creates the account for a verified Clerk user id. On an actual
   * create, publishes `account.created` to the `EventBus` (the welcome
   * email's trigger — see `modules/notifications/service.ts`). Creating a
   * project is a separate, explicit action the caller takes afterward (see
   * `modules/projects/service.ts`'s `createProject`) — this never creates
   * one.
   *
   * `emailHint` is the email from the caller's already-verified session
   * claims, if the Clerk instance happens to include one (see
   * `SessionClaims.email`) — passed through so a create doesn't need a
   * second round trip for something the caller already has. Only consulted
   * when actually creating a new account: an existing account's email was
   * already decided at its own bootstrap time and isn't overwritten here.
   *
   * Upsert semantics via the repository's insert-with-conflict-handling,
   * not a check-then-insert: two requests racing to bootstrap the same
   * brand-new user can both call this concurrently — exactly one create
   * succeeds, and the loser re-reads the winner's row instead of throwing
   * or double-creating a project.
   */
  ensureAccount(
    clerkUserId: string,
    emailHint?: string,
  ): Promise<EnsureAccountResult>

  /** The email of the account that owns `projectId`, for a domain-event notification to address — `undefined` if there's none on file. */
  getEmailForProject(projectId: string): Promise<string | undefined>
}

export function createAccountsService(
  repository: AccountsRepository,
  eventBus: EventBus = { publish: async () => {}, subscribe: () => {} },
  /**
   * Composition-root dependency (see `app.ts`), consulted only when
   * `emailHint` is absent and an account is actually being created —
   * defaults to a resolver that never finds one, which is exactly this
   * repo's state today: no Clerk backend API credentials are wired up
   * (see `infra/auth/` — only JWKS session verification exists), so
   * neither source can currently produce an email at bootstrap. Wiring a
   * real resolver here later (Clerk's backend API, once credentials are
   * available) needs no change to this service.
   */
  emailResolver: AccountEmailResolver = {
    resolveEmail: async () => undefined,
  },
): AccountsService {
  return {
    async ensureAccount(clerkUserId, emailHint) {
      // Checked up front, before resolving an email, so an *existing*
      // account never pays for an email lookup it won't use — only a
      // genuine create needs one. This read is redundant with the insert
      // below on the (existing-account) common path, but it's a cheap
      // indexed lookup, unlike a Clerk backend API call would be.
      const existing = await repository.findByClerkUserId(clerkUserId)
      if (existing) {
        return { accountId: existing.id, created: false, email: existing.email }
      }

      const email = emailHint ?? (await emailResolver.resolveEmail(clerkUserId))
      if (!email) {
        console.log(
          `No email available for clerk user ${clerkUserId} at account bootstrap; welcome email will be skipped.`,
        )
      }

      const created = await repository.create(clerkUserId, email ?? null)
      if (created) {
        await eventBus.publish('account.created', {
          accountId: created.id,
          clerkUserId,
          email: created.email,
        })
        return { accountId: created.id, created: true, email: created.email }
      }

      // Lost the create race to a concurrent caller — re-read its row
      // instead of erroring.
      const raced = await repository.findByClerkUserId(clerkUserId)
      if (!raced) {
        // The insert hit the unique conflict (so a row exists) but the
        // re-select didn't find it — should not happen outside of a
        // visibility race inside a broken transaction setup.
        throw new Error(
          `Failed to bootstrap account for clerk user ${clerkUserId}: row not found after conflict`,
        )
      }

      return { accountId: raced.id, created: false, email: raced.email }
    },

    async getEmailForProject(projectId) {
      return repository.findEmailByProjectId(projectId)
    },
  }
}
