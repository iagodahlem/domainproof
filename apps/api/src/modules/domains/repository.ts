import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '@infra/db/client'
import { challenges, domains } from '@infra/db/schema'
import type { DomainStatus } from '@domainproof/core'

export type DomainRow = typeof domains.$inferSelect
export type ChallengeRow = typeof challenges.$inferSelect
export type DomainMode = DomainRow['mode']
export type ChallengeMethod = ChallengeRow['method']

export interface ChallengeInsert {
  method: ChallengeMethod
  token: string
  recordHost: string
  recordValue: string
  expiresAt: Date
}

export interface ClaimInsert {
  projectId: string
  mode: DomainMode
  domain: string
  /** The status the new domain row is created with — computed by the caller via core's state machine. */
  status: DomainStatus
  challenge: ChallengeInsert
}

export interface DomainWithChallenge {
  domain: DomainRow
  challenge: ChallengeRow
}

export interface VerificationAttemptInsert {
  domainId: string
  /** The status computed by the caller via core's state machine (or the unchanged current status, for a no-op attempt). */
  nextStatus: DomainStatus
  /**
   * Set only when this attempt confirms the domain as verified — otherwise
   * `undefined` leaves the existing `verified_at` column untouched (e.g. a
   * `not_found`/`unreachable` attempt on a `pending` domain doesn't clear or
   * touch a timestamp that isn't set yet, and a lost record on a `verified`
   * domain doesn't erase when it was last confirmed good).
   */
  verifiedAt?: Date
}

/**
 * All db access for the domains module — the `domains` and `challenges`
 * tables, which together form one bounded context (a domain claim and its
 * current challenge). This is the only file in `modules/domains` allowed
 * to import `@infra/db`. The domain's event timeline is a separate
 * concern owned by `modules/events` — this repository no longer writes
 * timeline rows itself; `domains/service.ts` publishes to the `EventBus`
 * instead, after each of these calls commits.
 */
export interface DomainsRepository {
  /**
   * Inserts a domain and its initial challenge, atomically in one
   * transaction. Returns `undefined` (rather than throwing) on a
   * `(project_id, domain, mode)` conflict — the insert hits that unique
   * constraint via `ON CONFLICT DO NOTHING`, so the caller can distinguish
   * "already claimed" from every other failure without parsing a driver
   * error. The caller (`domains/service.ts`) publishes `domain.claimed` to
   * the `EventBus` after this resolves — not this repository's concern.
   */
  claim(values: ClaimInsert): Promise<DomainWithChallenge | undefined>

  /** All domains claimed by a project in the given mode. */
  listByProject(projectId: string, mode: DomainMode): Promise<DomainRow[]>

  /** Scoped to `(projectId, mode)` so a live key can never see a test-mode claim (or another project's) by id, and vice versa. */
  findById(
    projectId: string,
    mode: DomainMode,
    id: string,
  ): Promise<DomainRow | undefined>

  /** The most recently issued (non-superseded-by-date) challenge for a domain. */
  findLatestChallenge(domainId: string): Promise<ChallengeRow | undefined>

  /**
   * Deletes the domain claim, scoped to `(projectId, mode)` — a `FOREIGN
   * KEY ... ON DELETE CASCADE` takes its challenges (and any events
   * scoped to it) with it. Returns the deleted row, or `undefined` if no
   * domain with `id` exists under that project/mode.
   */
  release(
    projectId: string,
    mode: DomainMode,
    id: string,
  ): Promise<DomainRow | undefined>

  /**
   * Persists the outcome of one `verifyDomain` attempt: updates the
   * domain's status (and `verified_at`, if provided). Not scoped to
   * `(projectId, mode)` — the caller is expected to have already resolved
   * and authorized `domainId` via `findById`. Throws if `domainId` doesn't
   * exist (should never happen: the caller just read it in the same
   * request). The caller publishes the check/transition events to the
   * `EventBus` after this resolves — not this repository's concern.
   */
  recordVerificationAttempt(
    values: VerificationAttemptInsert,
  ): Promise<DomainRow>
}

export function createDomainsRepository(db: Database): DomainsRepository {
  return {
    async claim(values) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(domains)
          .values({
            projectId: values.projectId,
            domain: values.domain,
            mode: values.mode,
            status: values.status,
          })
          .onConflictDoNothing({
            target: [domains.projectId, domains.domain, domains.mode],
          })
          .returning()

        const domainRow = inserted[0]
        if (!domainRow) {
          return undefined
        }

        const [challengeRow] = await tx
          .insert(challenges)
          .values({
            domainId: domainRow.id,
            method: values.challenge.method,
            token: values.challenge.token,
            recordHost: values.challenge.recordHost,
            recordValue: values.challenge.recordValue,
            expiresAt: values.challenge.expiresAt,
          })
          .returning()

        if (!challengeRow) {
          throw new Error('Failed to create challenge: insert returned no row')
        }

        return { domain: domainRow, challenge: challengeRow }
      })
    },

    async listByProject(projectId, mode) {
      return db
        .select()
        .from(domains)
        .where(and(eq(domains.projectId, projectId), eq(domains.mode, mode)))
    },

    async findById(projectId, mode, id) {
      const [row] = await db
        .select()
        .from(domains)
        .where(
          and(
            eq(domains.projectId, projectId),
            eq(domains.mode, mode),
            eq(domains.id, id),
          ),
        )
        .limit(1)
      return row
    },

    async findLatestChallenge(domainId) {
      const [row] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.domainId, domainId))
        .orderBy(desc(challenges.createdAt))
        .limit(1)
      return row
    },

    async release(projectId, mode, id) {
      const [row] = await db
        .delete(domains)
        .where(
          and(
            eq(domains.projectId, projectId),
            eq(domains.mode, mode),
            eq(domains.id, id),
          ),
        )
        .returning()
      return row
    },

    async recordVerificationAttempt(values) {
      const [domainRow] = await db
        .update(domains)
        .set({
          status: values.nextStatus,
          updatedAt: new Date(),
          ...(values.verifiedAt ? { verifiedAt: values.verifiedAt } : {}),
        })
        .where(eq(domains.id, values.domainId))
        .returning()

      if (!domainRow) {
        throw new Error(
          `No domain found for id ${values.domainId} while recording a verification attempt`,
        )
      }

      return domainRow
    },
  }
}
