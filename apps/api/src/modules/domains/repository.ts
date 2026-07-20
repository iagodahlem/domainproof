import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '@infra/db/client'
import { challenges, domains, verificationEvents } from '@infra/db/schema'
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

export interface VerificationEventInsert {
  type: string
  detail: unknown
}

export interface ClaimInsert {
  projectId: string
  mode: DomainMode
  domain: string
  /** The status the new domain row is created with — computed by the caller via core's state machine. */
  status: DomainStatus
  challenge: ChallengeInsert
  event: VerificationEventInsert
}

export interface DomainWithChallenge {
  domain: DomainRow
  challenge: ChallengeRow
}

/**
 * All db access for the domains module — the `domains`, `challenges`, and
 * `verification_events` tables, which together form one bounded context
 * (a domain claim, its current challenge, and its timeline). This is the
 * only file in `modules/domains` allowed to import `@infra/db`.
 */
export interface DomainsRepository {
  /**
   * Inserts a domain, its initial challenge, and a timeline event for the
   * claim, atomically in one transaction. Returns `undefined` (rather than
   * throwing) on a `(project_id, domain, mode)` conflict — the insert hits
   * that unique constraint via `ON CONFLICT DO NOTHING`, so the caller can
   * distinguish "already claimed" from every other failure without parsing
   * a driver error.
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
   * KEY ... ON DELETE CASCADE` takes its challenges and timeline events
   * with it. Returns the deleted row, or `undefined` if no domain with `id`
   * exists under that project/mode.
   */
  release(
    projectId: string,
    mode: DomainMode,
    id: string,
  ): Promise<DomainRow | undefined>
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

        await tx.insert(verificationEvents).values({
          domainId: domainRow.id,
          type: values.event.type,
          detail: values.event.detail,
        })

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
  }
}
