import {
  DEFAULT_TOKEN_TTL_MS,
  checkTxt,
  isExpired,
  isSandboxDomain,
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
import type { DomainEventMap, EventBus, Mode } from '@shared/events'
import { decodeDomainsCursor, encodeDomainsCursor } from './domain/cursor'
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
  | { ok: false; error: 'sandbox_requires_test_mode' }

/**
 * The facts about one `verifyDomain` attempt: what the check found, when.
 * `expectedValue` is always the challenge's current record value (useful
 * beyond `wrong_value` alone), `detectedValues` is only ever non-empty for
 * `wrong_value`. Turning this into UI-facing copy (the `explanation`
 * strings for `not_found`/`unreachable`/`expired`) is a v1-plane
 * presentation concern, done in `apis/v1/routes/domains.ts` — same split as
 * `DomainSummary` vs. `serializeDomain`.
 *
 * `outcome` extends core's `TxtCheckResult['outcome']` with `'expired'`: a
 * fact `verifyDomain` decides *before* ever running a DNS check (a stale
 * challenge on a still-`pending` domain), not something `checkTxt` reports
 * — see `verifyDomain`'s expiry guard.
 */
export interface VerifyDomainCheck {
  outcome: TxtCheckResult['outcome'] | 'expired'
  checkedAt: Date
  expectedValue: string
  detectedValues: string[]
}

export type VerifyDomainResult =
  | { ok: true; domain: DomainSummary; check: VerifyDomainCheck }
  | { ok: false; error: 'not_found' }

export type RegenerateChallengeResult =
  | { ok: true; domain: DomainSummary }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'invalid_status' }

export interface ListProjectDomainsOptions {
  limit: number
  cursor?: string
}

export interface ListProjectDomainsResult {
  domains: DomainSummary[]
  /** `null` once the last page has been reached. */
  nextCursor: string | null
}

export interface DomainsService {
  /**
   * Claims a domain for a project: normalizes/validates the input,
   * generates a fresh challenge token, and persists the domain + its
   * initial challenge in one call, then publishes `domain.claimed` to the
   * `EventBus`. Returns a typed `conflict` result (never throws) if
   * `(projectId, domain, mode)`
   * was already claimed — the exact same domain CAN be claimed again by a
   * different project or a different mode; the constraint is per
   * `(project, domain, mode)`, not global.
   *
   * Also returns a typed `sandbox_requires_test_mode` result for a `.test`
   * domain claimed with a `live`-mode key. Sandbox domains never touch real
   * DNS and exist purely to demo/test the verification flow — claiming one
   * "for real" with a live key would be a live-mode project silently
   * depending on fixture behavior that isn't actually verifying anything.
   * `test`-mode keys are unaffected either direction: they can claim both
   * sandbox and real domains, same as before this rule existed.
   */
  claimDomain(input: ClaimDomainInput): Promise<ClaimDomainResult>

  /** All domains claimed by a project in the given mode. */
  listDomains(projectId: string, mode: DomainMode): Promise<DomainSummary[]>

  /**
   * A project's domains across both modes, newest first, cursor-paginated
   * — the dashboard's domains table. Plane-agnostic unlike `listDomains`:
   * a dashboard caller resolves `projectId` via `resolveOwnedProject` and
   * has no api-key `mode` to scope by, since the dashboard shows a
   * project's test and live claims together (with `mode` as a per-row
   * field, not a filter).
   */
  listProjectDomains(
    projectId: string,
    options: ListProjectDomainsOptions,
  ): Promise<ListProjectDomainsResult>

  /** `null` if `id` doesn't belong to `(projectId, mode)`. */
  getDomain(
    projectId: string,
    mode: DomainMode,
    id: string,
  ): Promise<DomainSummary | null>

  /**
   * Like `getDomain`, but scoped only to `projectId` (no `mode`) — the
   * dashboard's domain detail/events routes. `null` if `id` doesn't belong
   * to `projectId`.
   */
  getProjectDomain(projectId: string, id: string): Promise<DomainSummary | null>

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
   * Like `releaseDomain`, but scoped only to `projectId` (no `mode`) — the
   * dashboard's domain delete route. `null` if `id` doesn't belong to
   * `projectId`.
   */
  releaseProjectDomain(
    projectId: string,
    id: string,
  ): Promise<DomainSummary | null>

  /**
   * Runs the DNS check for a claimed domain's current challenge, transitions
   * its status through core's state machine (see
   * `domain/verification-event.ts` for the outcome -> event mapping), and
   * publishes `domain.check_passed`/`domain.check_failed` (plus
   * `domain.verified`/`domain.temporarily_failed`/`domain.failed` when the
   * status actually changed) to the `EventBus` — always, regardless of
   * whether the outcome changed anything (a merely inconclusive
   * `unreachable` outcome publishes neither). Never throws for a domain that
   * simply isn't ready yet (`not_found`/`unreachable` are normal, expected
   * outcomes, not errors) — only a typed `not_found` result for an unknown
   * (or not-this-project/-mode) `id`. Re-verifying an already-verified (or
   * already-failed) domain is expected and safe: see the mapping's doc
   * comment for exactly what each starting status does with each outcome.
   *
   * A `pending` domain whose challenge has outlived core's verification
   * window (`isExpired`/`DEFAULT_TOKEN_TTL_MS`) is hard-failed here without
   * ever running the DNS check — the `check` result's `outcome` is
   * `'expired'` rather than any of `checkTxt`'s outcomes. This does not
   * apply to `verified`/`temporarily_failed` domains: their original
   * challenge already did its job, and their ongoing rechecks are governed
   * by `recheck_passed`/`recheck_record_lost`/`grace_expired`, not this
   * challenge's expiry.
   */
  verifyDomain(
    projectId: string,
    mode: DomainMode,
    id: string,
  ): Promise<VerifyDomainResult>

  /**
   * Like `verifyDomain`, but scoped only to `projectId` (no `mode`) — the
   * dashboard's domain verify route, whose caller has no api-key mode to
   * further scope by. Same check/transition/event-publish behavior as
   * `verifyDomain`; only how the domain is resolved differs.
   */
  verifyProjectDomain(
    projectId: string,
    id: string,
  ): Promise<VerifyDomainResult>

  /**
   * Issues a fresh challenge token for a domain, restarting verification —
   * the dashboard's "regenerate" action for a `pending` domain whose window
   * is about to (or already did) expire, or a `failed` domain the caller
   * wants to retry, without releasing and reclaiming it (which would also
   * reset its event timeline's claim). Routes through core's state machine
   * (`challenge_regenerated`), so it's only legal from `pending` or
   * `failed` — a `verified`/`temporarily_failed` domain's current challenge
   * already did its job, and this returns a typed `invalid_status` result
   * rather than silently no-op'ing. The previous challenge is marked
   * superseded, not deleted (see `repository.ts`'s `regenerateChallenge`)
   * — publishes `domain.challenge_regenerated` to the `EventBus`. `null`-
   * shaped as a typed `not_found` result if `id` doesn't belong to
   * `projectId`, same as `getProjectDomain`.
   */
  regenerateChallenge(
    projectId: string,
    id: string,
  ): Promise<RegenerateChallengeResult>
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

/**
 * Publishes the events one `verifyDomain` attempt produces: a
 * `domain.check_passed`/`domain.check_failed` for the attempt itself (a
 * merely inconclusive `unreachable` outcome — "we don't know", not a
 * definitive answer, see `checkTxt`'s doc comment — publishes neither),
 * plus `domain.verified`/`domain.temporarily_failed`/`domain.failed` when
 * the status actually changed. Shared by both `verifyDomain` branches (the
 * expiry short-circuit and the real DNS-check path) so the mapping from
 * outcome/transition to published events lives in exactly one place.
 */
async function publishVerifyDomainEvents(
  eventBus: EventBus,
  params: {
    domainId: string
    projectId: string
    mode: Mode
    domain: string
    outcome: VerifyDomainCheck['outcome']
    previousStatus: DomainStatus
    nextStatus: DomainStatus
  },
): Promise<void> {
  const {
    domainId,
    projectId,
    mode,
    domain,
    outcome,
    previousStatus,
    nextStatus,
  } = params
  const base: DomainEventMap['domain.claimed'] = {
    domainId,
    projectId,
    mode,
    domain,
  }

  if (outcome === 'found') {
    await eventBus.publish('domain.check_passed', base)
  } else if (outcome !== 'unreachable') {
    await eventBus.publish('domain.check_failed', { ...base, outcome })
  }

  if (nextStatus !== previousStatus) {
    if (nextStatus === 'verified') {
      await eventBus.publish('domain.verified', base)
    } else if (nextStatus === 'temporarily_failed') {
      await eventBus.publish('domain.temporarily_failed', base)
    } else if (nextStatus === 'failed') {
      await eventBus.publish('domain.failed', base)
    }
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
  /**
   * Composition-root dependency (see `app.ts`) this service publishes to
   * after each state transition commits — never before, and never as a
   * side effect inside core's `transition()` itself (see
   * ARCHITECTURE.md's "Planned: events"). Defaults to a no-op bus so the
   * many tests below that don't care about published events don't need to
   * supply one; tests that do (see `service.test.ts`) pass a fake.
   */
  eventBus: EventBus = { publish: async () => {}, subscribe: () => {} },
): DomainsService {
  /**
   * The body of one `verifyDomain` attempt, shared by `verifyDomain`
   * (mode-scoped, v1) and `verifyProjectDomain` (project-scoped, dashboard)
   * — the two only differ in how `row` gets resolved and authorized; once
   * resolved, checking/transitioning/publishing/persisting is identical, so
   * it lives here exactly once rather than being copied per plane.
   */
  async function verifyRow(row: DomainRow): Promise<VerifyDomainResult> {
    const challenge = await repository.findLatestChallenge(row.id)
    if (!challenge) {
      // Cannot happen: claimDomain always creates a challenge alongside
      // the domain, in the same transaction — guarded rather than
      // asserted so a corrupted/partially-migrated row fails loudly.
      throw new Error(`No challenge found for domain ${row.id}`)
    }

    const slug = await projectsService.getProjectSlug(row.projectId)
    if (!slug) {
      // Cannot happen for a projectId resolved from an authenticated api
      // key context, or from `resolveOwnedProject` — see the identical
      // guard in claimDomain.
      throw new Error(`No project found for id ${row.projectId}`)
    }

    const currentStatus = row.status as DomainStatus
    const checkedAt = now()

    // The verification window (states.ts: pending -> failed once it
    // "elapses with no correct record") is scoped to a domain's *first*
    // verification, tracked by the challenge's own `expiresAt` — not to
    // every recheck for the rest of the domain's life. Only a `pending`
    // domain can still be inside (or have outlived) that window; a
    // `verified` domain's original challenge already did its job, and
    // its ongoing rechecks are governed by the separate
    // recheck_passed/recheck_record_lost/grace_expired vocabulary, which
    // has nothing to do with this challenge's expiry. So this guard is
    // scoped to `pending` only, deliberately.
    //
    // A stale challenge is hard-failed here without ever running the DNS
    // check: whatever is (or isn't) published is moot once the window
    // that would have counted it has already closed — spending a DNS
    // query on it would be pure latency with no possible different
    // outcome.
    if (
      currentStatus === 'pending' &&
      isExpired(challenge.createdAt, checkedAt)
    ) {
      const transitioned = transition(currentStatus, {
        type: 'check_hard_failed',
      })
      const nextStatus = transitioned.ok ? transitioned.next : currentStatus

      const updatedRow = await repository.recordVerificationAttempt({
        domainId: row.id,
        nextStatus,
      })

      await publishVerifyDomainEvents(eventBus, {
        domainId: row.id,
        projectId: row.projectId,
        mode: row.mode,
        domain: row.domain,
        outcome: 'expired',
        previousStatus: currentStatus,
        nextStatus,
      })

      return {
        ok: true,
        domain: toSummary(updatedRow, [challenge]),
        check: {
          outcome: 'expired',
          checkedAt,
          expectedValue: challenge.recordValue,
          detectedValues: [],
        },
      }
    }

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
    })

    await publishVerifyDomainEvents(eventBus, {
      domainId: row.id,
      projectId: row.projectId,
      mode: row.mode,
      domain: row.domain,
      outcome: result.outcome,
      previousStatus: currentStatus,
      nextStatus,
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
  }

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

      if (mode === 'live' && isSandboxDomain(normalized.domain)) {
        return { ok: false, error: 'sandbox_requires_test_mode' }
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
      })

      if (!result) {
        return { ok: false, error: 'conflict' }
      }

      await eventBus.publish('domain.claimed', {
        domainId: result.domain.id,
        projectId,
        mode,
        domain: normalized.domain,
      })

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

    async listProjectDomains(projectId, { limit, cursor }) {
      const decodedCursor = cursor ? decodeDomainsCursor(cursor) : undefined
      const { rows, hasMore } = await repository.listByProjectPaginated(
        projectId,
        { limit, cursor: decodedCursor },
      )

      const summaries = await Promise.all(
        rows.map(async (row) => {
          const challenge = await repository.findLatestChallenge(row.id)
          return toSummary(row, challenge ? [challenge] : [])
        }),
      )

      const lastRow = rows[rows.length - 1]
      const nextCursor =
        hasMore && lastRow ? encodeDomainsCursor({ id: lastRow.id }) : null

      return { domains: summaries, nextCursor }
    },

    async getDomain(projectId, mode, id) {
      const row = await repository.findById(projectId, mode, id)
      if (!row) {
        return null
      }
      const challenge = await repository.findLatestChallenge(row.id)
      return toSummary(row, challenge ? [challenge] : [])
    },

    async getProjectDomain(projectId, id) {
      const row = await repository.findByProjectId(projectId, id)
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

    async releaseProjectDomain(projectId, id) {
      const row = await repository.releaseByProjectId(projectId, id)
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
      return verifyRow(row)
    },

    async verifyProjectDomain(projectId, id) {
      const row = await repository.findByProjectId(projectId, id)
      if (!row) {
        return { ok: false, error: 'not_found' }
      }
      return verifyRow(row)
    },

    async regenerateChallenge(projectId, id) {
      const row = await repository.findByProjectId(projectId, id)
      if (!row) {
        return { ok: false, error: 'not_found' }
      }

      const currentStatus = row.status as DomainStatus
      const transitioned = transition(currentStatus, {
        type: 'challenge_regenerated',
      })
      if (!transitioned.ok) {
        return { ok: false, error: 'invalid_status' }
      }

      const slug = await projectsService.getProjectSlug(row.projectId)
      if (!slug) {
        // Cannot happen for a domain resolved via `findByProjectId` from
        // an owned project — see the identical guard in claimDomain.
        throw new Error(`No project found for id ${row.projectId}`)
      }

      const token = generateToken()
      const method: ChallengeMethod = 'dns_txt'
      const recordHost = challengeHost(row.domain, slug)
      const recordValueString = recordValue(token, slug)
      const expiresAt = new Date(Date.now() + DEFAULT_TOKEN_TTL_MS)

      const result = await repository.regenerateChallenge({
        domainId: row.id,
        nextStatus: transitioned.next,
        challenge: {
          method,
          token,
          recordHost,
          recordValue: recordValueString,
          expiresAt,
        },
      })

      await eventBus.publish('domain.challenge_regenerated', {
        domainId: row.id,
        projectId: row.projectId,
        mode: row.mode,
        domain: row.domain,
      })

      return {
        ok: true,
        domain: toSummary(result.domain, [result.challenge]),
      }
    },
  }
}
