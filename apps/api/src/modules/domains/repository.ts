import { and, desc, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import type { Database } from '@infra/db/client'
import { challenges, domains } from '@infra/db/schema'
import type { DomainStatus } from '@domainproof/core'
import type { DomainsCursor } from './domain/cursor'

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
  /** The first due-ness checkpoint for the background re-check worker — see `domain/recheck-schedule.ts`'s `firstPendingCheckAt`. */
  nextCheckAt: Date
  challenge: ChallengeInsert
}

export interface DomainWithChallenge {
  domain: DomainRow
  challenge: ChallengeRow
}

export interface ListByProjectPaginatedOptions {
  limit: number
  cursor?: DomainsCursor
}

export interface ListByProjectPaginatedResult {
  rows: DomainRow[]
  /** `true` when more rows exist past the returned page. */
  hasMore: boolean
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
  /** When this attempt (or, for a grace-window expiry, this sweep) ran — persisted as `last_checked_at`. */
  checkedAt: Date
  /** The due-ness worker's next checkpoint — see `domain/recheck-schedule.ts`. `null` means "not scheduled" (a `failed` domain). */
  nextCheckAt: Date | null
  /** The pending-backoff rung this attempt leaves the domain at — see `domain/recheck-schedule.ts`. */
  checkAttempts: number
  /**
   * `undefined` leaves `grace_expires_at` untouched; `null` clears it;
   * a `Date` sets it. See `domain/recheck-schedule.ts`.
   */
  graceExpiresAt?: Date | null
}

export interface RegenerateChallengeInsert {
  domainId: string
  /** The status computed by the caller via core's state machine. */
  nextStatus: DomainStatus
  challenge: ChallengeInsert
  /**
   * A regenerated challenge restarts verification, so it gets the same
   * fresh due-ness checkpoint a newly claimed domain does — see
   * `domain/recheck-schedule.ts`'s `firstPendingCheckAt`.
   */
  nextCheckAt: Date
  /** Reset to 0 — a fresh challenge restarts the pending backoff ladder from its first rung. */
  checkAttempts: number
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

  /**
   * A project's domains across both modes, newest first, cursor-paginated
   * on `(created_at, id)` — the dashboard's domains table, whose caller has
   * no api-key mode to scope by (see `listByProject`, which does). Fetches
   * `limit + 1` rows to decide `hasMore` without a second round-trip, then
   * trims back to `limit`.
   */
  listByProjectPaginated(
    projectId: string,
    options: ListByProjectPaginatedOptions,
  ): Promise<ListByProjectPaginatedResult>

  /** Scoped to `(projectId, mode)` so a live key can never see a test-mode claim (or another project's) by id, and vice versa. */
  findById(
    projectId: string,
    mode: DomainMode,
    id: string,
  ): Promise<DomainRow | undefined>

  /**
   * Like `findById`, but scoped only to `projectId` (no `mode`) — the
   * dashboard's domain detail/events routes, whose caller has no api-key
   * mode to further scope by.
   */
  findByProjectId(projectId: string, id: string): Promise<DomainRow | undefined>

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
   * Like `release`, but scoped only to `projectId` (no `mode`) — the
   * dashboard's domain delete route, whose caller has no api-key mode to
   * further scope by. Same cascade-delete behavior as `release`.
   */
  releaseByProjectId(
    projectId: string,
    id: string,
  ): Promise<DomainRow | undefined>

  /**
   * Persists the outcome of one `verifyDomain` attempt: updates the
   * domain's status (and `verified_at`, if provided), plus the background
   * worker's due-ness bookkeeping (`last_checked_at`, `next_check_at`,
   * `check_attempts`, `grace_expires_at` — see `domain/recheck-schedule.ts`).
   * Not scoped to `(projectId, mode)` — the caller is expected to have
   * already resolved and authorized `domainId` via `findById`. Throws if
   * `domainId` doesn't exist (should never happen: the caller just read it
   * in the same request). The caller publishes the check/transition events
   * to the `EventBus` after this resolves — not this repository's concern.
   */
  recordVerificationAttempt(
    values: VerificationAttemptInsert,
  ): Promise<DomainRow>

  /**
   * Regenerates a domain's challenge: marks its current (non-superseded)
   * challenge as superseded and inserts a fresh one, atomically in one
   * transaction, alongside updating the domain's status and due-ness
   * bookkeeping (`next_check_at`/`check_attempts` — see
   * `infra/db/schema.ts`'s `challenges` table doc comment for why this
   * supersedes rather than deletes/mutates the old row). Not scoped to
   * `(projectId, mode)` — the caller is expected to have already resolved
   * and authorized `domainId` (via `findByProjectId`), same contract as
   * `recordVerificationAttempt`.
   */
  regenerateChallenge(
    values: RegenerateChallengeInsert,
  ): Promise<DomainWithChallenge>

  /**
   * Every domain (across all projects/modes — this is the background
   * worker's own selection, not a tenant-scoped read) whose `next_check_at`
   * has elapsed, oldest-due first, capped at `limit`. `failed` domains are
   * never returned: their `next_check_at` is `null` (see
   * `recordVerificationAttempt`).
   */
  findDueForRecheck(now: Date, limit: number): Promise<DomainRow[]>

  /**
   * Every `temporarily_failed` domain whose 72h `grace_expires_at` has
   * elapsed without recovering, oldest-expired first, capped at `limit` —
   * the background worker's grace-window expiry sweep (core's
   * `grace_expired` event, timed here rather than by any single
   * `verifyDomain` attempt — see its doc comment).
   */
  findOverdueGraceWindows(now: Date, limit: number): Promise<DomainRow[]>
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
            nextCheckAt: values.nextCheckAt,
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

    async listByProjectPaginated(projectId, { limit, cursor }) {
      // Anchored on the cursor row's own stored `(created_at, id)`, looked
      // up server-side in the same query — see `domain/cursor.ts`'s doc
      // comment for why a JS-truncated timestamp can't do this precisely.
      // Scoped to `projectId` too, so a cursor id from a different
      // project's list (or one that no longer exists) can't anchor against
      // another project's data — it just yields an empty page.
      const cursorCondition = cursor
        ? sql`(${domains.createdAt}, ${domains.id}) < (
            select created_at, id from domains
            where id = ${cursor.id} and project_id = ${projectId}
          )`
        : undefined

      const rows = await db
        .select()
        .from(domains)
        .where(
          cursorCondition
            ? and(eq(domains.projectId, projectId), cursorCondition)
            : eq(domains.projectId, projectId),
        )
        .orderBy(desc(domains.createdAt), desc(domains.id))
        .limit(limit + 1)

      const hasMore = rows.length > limit
      return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore }
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

    async findByProjectId(projectId, id) {
      const [row] = await db
        .select()
        .from(domains)
        .where(and(eq(domains.projectId, projectId), eq(domains.id, id)))
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

    async releaseByProjectId(projectId, id) {
      const [row] = await db
        .delete(domains)
        .where(and(eq(domains.projectId, projectId), eq(domains.id, id)))
        .returning()
      return row
    },

    async recordVerificationAttempt(values) {
      const [domainRow] = await db
        .update(domains)
        .set({
          status: values.nextStatus,
          updatedAt: new Date(),
          lastCheckedAt: values.checkedAt,
          nextCheckAt: values.nextCheckAt,
          checkAttempts: values.checkAttempts,
          ...(values.verifiedAt ? { verifiedAt: values.verifiedAt } : {}),
          ...(values.graceExpiresAt !== undefined
            ? { graceExpiresAt: values.graceExpiresAt }
            : {}),
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

    async regenerateChallenge(values) {
      return db.transaction(async (tx) => {
        await tx
          .update(challenges)
          .set({ supersededAt: new Date() })
          .where(
            and(
              eq(challenges.domainId, values.domainId),
              isNull(challenges.supersededAt),
            ),
          )

        const [challengeRow] = await tx
          .insert(challenges)
          .values({
            domainId: values.domainId,
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

        const [domainRow] = await tx
          .update(domains)
          .set({
            status: values.nextStatus,
            updatedAt: new Date(),
            nextCheckAt: values.nextCheckAt,
            checkAttempts: values.checkAttempts,
          })
          .where(eq(domains.id, values.domainId))
          .returning()

        if (!domainRow) {
          throw new Error(
            `No domain found for id ${values.domainId} while regenerating its challenge`,
          )
        }

        return { domain: domainRow, challenge: challengeRow }
      })
    },

    async findDueForRecheck(now, limit) {
      return db
        .select()
        .from(domains)
        .where(
          and(isNotNull(domains.nextCheckAt), lte(domains.nextCheckAt, now)),
        )
        .orderBy(domains.nextCheckAt)
        .limit(limit)
    },

    async findOverdueGraceWindows(now, limit) {
      return db
        .select()
        .from(domains)
        .where(
          and(
            eq(domains.status, 'temporarily_failed'),
            isNotNull(domains.graceExpiresAt),
            lte(domains.graceExpiresAt, now),
          ),
        )
        .orderBy(domains.graceExpiresAt)
        .limit(limit)
    },
  }
}
