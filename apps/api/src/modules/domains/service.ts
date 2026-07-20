import {
  DEFAULT_TOKEN_TTL_MS,
  checkTxt,
  type DomainStatus,
  type NormalizeDomainFailureReason,
  type TxtCheckResult,
  challengeHost,
  generateToken,
  normalizeDomain,
  recordValue,
  transition,
} from '@domainproof/core'
import type { ProjectsService } from '@modules/projects/service'
import { eventForCheckOutcome } from './domain/verification-event'
import type { ResolverForChallenge } from './ports'
import type {
  ChallengeMethod,
  ChallengeRow,
  DomainMode,
  DomainRow,
  DomainsRepository,
} from './repository'

export interface ChallengeSummary {
  method: ChallengeMethod
  recordHost: string
  recordValue: string
}

/**
 * Plane-agnostic view of a domain claim: the facts, not the presentation.
 * Turning this into the public API's `records`-as-data response shape
 * (record `type`/`purpose`/`description` copy, `verificationUrl`) is a
 * v1-plane concern, done in `apis/v1/routes/domains.ts` — this module has
 * no opinion on API wording, only on what's true about the claim.
 */
export interface DomainSummary {
  id: string
  projectId: string
  domain: string
  mode: DomainMode
  status: DomainStatus
  createdAt: Date
  updatedAt: Date
  verifiedAt: Date | null
  challenges: ChallengeSummary[]
}

export interface ClaimDomainInput {
  projectId: string
  mode: DomainMode
  domain: string
}

export type ClaimDomainResult =
  | { ok: true; domain: DomainSummary }
  | {
      ok: false
      error: 'invalid_domain'
      reason: NormalizeDomainFailureReason
    }
  | { ok: false; error: 'conflict' }

/**
 * The facts about one `verifyDomain` attempt: what the check found, when.
 * `expectedValue` is always the challenge's current record value (useful
 * beyond `wrong_value` alone), `detectedValues` is only ever non-empty for
 * `wrong_value`. Turning this into UI-facing copy (the `explanation`
 * strings for `not_found`/`unreachable`) is a v1-plane presentation
 * concern, done in `apis/v1/routes/domains.ts` — same split as
 * `DomainSummary` vs. `serializeDomain`.
 */
export interface VerifyDomainCheck {
  outcome: TxtCheckResult['outcome']
  checkedAt: Date
  expectedValue: string
  detectedValues: string[]
}

export type VerifyDomainResult =
  | { ok: true; domain: DomainSummary; check: VerifyDomainCheck }
  | { ok: false; error: 'not_found' }

export interface DomainsService {
  /**
   * Claims a domain for a project: normalizes/validates the input,
   * generates a fresh challenge token, and persists the domain + its
   * initial challenge + a claim timeline event in one call. Returns a
   * typed `conflict` result (never throws) if `(projectId, domain, mode)`
   * was already claimed — the exact same domain CAN be claimed again by a
   * different project or a different mode; the constraint is per
   * `(project, domain, mode)`, not global.
   */
  claimDomain(input: ClaimDomainInput): Promise<ClaimDomainResult>

  /** All domains claimed by a project in the given mode. */
  listDomains(projectId: string, mode: DomainMode): Promise<DomainSummary[]>

  /** `null` if `id` doesn't belong to `(projectId, mode)`. */
  getDomain(
    projectId: string,
    mode: DomainMode,
    id: string,
  ): Promise<DomainSummary | null>

  /**
   * Releases a claim: deletes the domain (and, via cascade, its challenges
   * and timeline). Returns the released domain's summary, or `null` if
   * `id` doesn't belong to `(projectId, mode)`.
   */
  releaseDomain(
    projectId: string,
    mode: DomainMode,
    id: string,
  ): Promise<DomainSummary | null>

  /**
   * Runs the DNS check for a claimed domain's current challenge, transitions
   * its status through core's state machine (see
   * `domain/verification-event.ts` for the outcome -> event mapping), and
   * records the attempt on the domain's timeline — always, regardless of
   * whether the outcome changed anything. Never throws for a domain that
   * simply isn't ready yet (`not_found`/`unreachable` are normal, expected
   * outcomes, not errors) — only a typed `not_found` result for an unknown
   * (or not-this-project/-mode) `id`. Re-verifying an already-verified (or
   * already-failed) domain is expected and safe: see the mapping's doc
   * comment for exactly what each starting status does with each outcome.
   */
  verifyDomain(
    projectId: string,
    mode: DomainMode,
    id: string,
  ): Promise<VerifyDomainResult>
}

function toSummary(
  domain: DomainRow,
  challenges: ChallengeRow[],
): DomainSummary {
  return {
    id: domain.id,
    projectId: domain.projectId,
    domain: domain.domain,
    mode: domain.mode,
    // `pgEnum`'s runtime values come from `DOMAIN_STATUSES` (see
    // `infra/db/schema.ts`), but the cast that feeds them to `pgEnum`
    // erases the literal union, so drizzle infers `domains.status` as
    // plain `string`. The db's own enum type guarantees this is always a
    // valid `DomainStatus`, so this narrows back to it rather than
    // widening `DomainSummary.status` to `string` for every caller.
    status: domain.status as DomainStatus,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    verifiedAt: domain.verifiedAt,
    challenges: challenges.map((challenge) => ({
      method: challenge.method,
      recordHost: challenge.recordHost,
      recordValue: challenge.recordValue,
    })),
  }
}

export function createDomainsService(
  repository: DomainsRepository,
  projectsService: ProjectsService,
  /**
   * Composition-root dependency (see `app.ts`) that picks the right
   * `DnsResolver` for a verification attempt — sandbox vs. real DNS — per
   * ARCHITECTURE.md's rule that `modules/*` never imports a concrete infra
   * adapter itself. Defaults to a stub that throws if `verifyDomain` is
   * ever called without one configured: every other use case in this
   * service (claim/list/get/release) never touches this dependency, so
   * tests exercising only those don't need to supply it.
   */
  resolverForChallenge: ResolverForChallenge = () => {
    throw new Error(
      'verifyDomain requires a resolverForChallenge dependency to be configured',
    )
  },
  /** Clock, injected for deterministic tests. Default `() => new Date()`. */
  now: () => Date = () => new Date(),
): DomainsService {
  return {
    async claimDomain({ projectId, mode, domain }) {
      const normalized = normalizeDomain(domain)
      if (!normalized.ok) {
        return {
          ok: false,
          error: 'invalid_domain',
          reason: normalized.reason,
        }
      }

      const slug = await projectsService.getProjectSlug(projectId)
      if (!slug) {
        // Cannot happen for a projectId resolved from an authenticated api
        // key context (the key's project always exists) — guarded rather
        // than asserted so a stale/deleted project fails loudly instead of
        // silently building a record host for nothing.
        throw new Error(`No project found for id ${projectId}`)
      }

      // Issuing a challenge starts verification immediately, so the new
      // domain's persisted status goes through core's state machine rather
      // than being hardcoded — not_started -> pending on
      // "verification_started" is the only transition claimDomain ever
      // needs, but routing it through `transition()` keeps every status
      // change auditable in the one place the architecture rules require.
      const started = transition('not_started', {
        type: 'verification_started',
      })
      if (!started.ok) {
        throw new Error(
          'Unexpected invalid transition starting domain verification',
        )
      }

      const token = generateToken()
      const method: ChallengeMethod = 'dns_txt'
      const recordHost = challengeHost(normalized.domain, slug)
      const recordValueString = recordValue(token, slug)
      const expiresAt = new Date(Date.now() + DEFAULT_TOKEN_TTL_MS)

      const result = await repository.claim({
        projectId,
        mode,
        domain: normalized.domain,
        status: started.next,
        challenge: {
          method,
          token,
          recordHost,
          recordValue: recordValueString,
          expiresAt,
        },
        event: {
          type: 'domain_claimed',
          detail: { method, recordHost, mode },
        },
      })

      if (!result) {
        return { ok: false, error: 'conflict' }
      }

      return {
        ok: true,
        domain: toSummary(result.domain, [result.challenge]),
      }
    },

    async listDomains(projectId, mode) {
      const rows = await repository.listByProject(projectId, mode)
      return Promise.all(
        rows.map(async (row) => {
          const challenge = await repository.findLatestChallenge(row.id)
          return toSummary(row, challenge ? [challenge] : [])
        }),
      )
    },

    async getDomain(projectId, mode, id) {
      const row = await repository.findById(projectId, mode, id)
      if (!row) {
        return null
      }
      const challenge = await repository.findLatestChallenge(row.id)
      return toSummary(row, challenge ? [challenge] : [])
    },

    async releaseDomain(projectId, mode, id) {
      const row = await repository.release(projectId, mode, id)
      if (!row) {
        return null
      }
      // No challenge lookup here: the cascade delete already removed the
      // released domain's challenges, so there's nothing left to fetch.
      return toSummary(row, [])
    },

    async verifyDomain(projectId, mode, id) {
      const row = await repository.findById(projectId, mode, id)
      if (!row) {
        return { ok: false, error: 'not_found' }
      }

      const challenge = await repository.findLatestChallenge(row.id)
      if (!challenge) {
        // Cannot happen: claimDomain always creates a challenge alongside
        // the domain, in the same transaction — guarded rather than
        // asserted so a corrupted/partially-migrated row fails loudly.
        throw new Error(`No challenge found for domain ${row.id}`)
      }

      const slug = await projectsService.getProjectSlug(projectId)
      if (!slug) {
        // Cannot happen for a projectId resolved from an authenticated api
        // key context — see the identical guard in claimDomain.
        throw new Error(`No project found for id ${projectId}`)
      }

      const checkedAt = now()
      const resolver = resolverForChallenge({
        domain: row.domain,
        recordHost: challenge.recordHost,
        recordValue: challenge.recordValue,
        brandSlug: slug,
        challengeCreatedAt: challenge.createdAt,
        now,
      })

      const result = await checkTxt(
        resolver,
        challenge.recordHost,
        challenge.token,
        slug,
      )

      const currentStatus = row.status as DomainStatus
      const event = eventForCheckOutcome(currentStatus, result.outcome)

      let nextStatus: DomainStatus = currentStatus
      if (event) {
        const transitioned = transition(currentStatus, event)
        if (transitioned.ok) {
          nextStatus = transitioned.next
        }
        // else: eventForCheckOutcome proposed an illegal (status, event)
        // pair — its own tests guarantee this can't happen, but if it ever
        // did, the safest thing to do is nothing, not throw and lose the
        // attempt.
      }

      const verifiedAt = nextStatus === 'verified' ? checkedAt : undefined

      const detectedValues =
        result.outcome === 'wrong_value' ? result.detected : []

      const updatedRow = await repository.recordVerificationAttempt({
        domainId: row.id,
        nextStatus,
        verifiedAt,
        event: {
          type: 'domain_verify_attempted',
          detail: {
            outcome: result.outcome,
            previousStatus: currentStatus,
            nextStatus,
            ...(detectedValues.length > 0 ? { detected: detectedValues } : {}),
          },
        },
      })

      return {
        ok: true,
        domain: toSummary(updatedRow, [challenge]),
        check: {
          outcome: result.outcome,
          checkedAt,
          expectedValue: challenge.recordValue,
          detectedValues,
        },
      }
    },
  }
}
