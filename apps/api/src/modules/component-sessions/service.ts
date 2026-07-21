import {
  generateToken,
  type NormalizeDomainFailureReason,
} from '@domainproof/core'
import type { DomainsService, DomainSummary } from '@modules/domains/service'
import type {
  ComponentSessionMode,
  ComponentSessionsRepository,
} from './repository'

/**
 * How long a minted session stays claimable if it's never spent — much
 * shorter than a domain claim's own 72h verification window (see core's
 * `DEFAULT_TOKEN_TTL_MS`): this token only needs to survive the round trip
 * from the integrator's backend to their own frontend component, not an
 * end user slowly publishing a DNS record.
 */
const SESSION_TTL_MS = 60 * 60 * 1000 // 1 hour

export interface CreateComponentSessionInput {
  projectId: string
  mode: ComponentSessionMode
  /** Correlates the claim this session eventually produces with the caller's own data model — see `infra/db/schema.ts`'s `component_sessions.external_id` doc comment. */
  externalId?: string
}

export interface CreateComponentSessionResult {
  /** The session's bearer credential — shown exactly once, embedded by the caller into whatever it hands its frontend component. */
  sessionToken: string
  expiresAt: Date
}

export type ClaimWithSessionResult =
  | { ok: true; domain: DomainSummary }
  | { ok: false; error: 'session_not_found' }
  | {
      ok: false
      error: 'invalid_domain'
      reason: NormalizeDomainFailureReason
    }
  | { ok: false; error: 'conflict' }
  | { ok: false; error: 'sandbox_requires_test_mode' }

export interface ComponentSessionsService {
  /**
   * Mints a session token good for exactly one domain claim, scoped to
   * whatever `projectId`/`mode` the caller resolved (the v1 route resolves
   * these from the authenticated api key, the same way every other v1
   * route does — this service has no opinion on where they came from).
   * Expires after {@link SESSION_TTL_MS} whether or not it's ever spent.
   */
  createSession(
    input: CreateComponentSessionInput,
  ): Promise<CreateComponentSessionResult>

  /**
   * Spends a session token: atomically marks it consumed (see
   * `ComponentSessionsRepository.consumeIfAvailable`'s doc comment for why
   * that has to happen before the claim itself runs, not after) and then
   * claims `domain` through the exact same `DomainsService.claimDomain`
   * path a v1 caller uses — `projectId`/`mode` from the session, and
   * `externalId` stamped from whatever was passed at mint time.
   *
   * A session is single-use regardless of outcome: an unknown, expired, or
   * already-consumed token, and a second attempt after this call already
   * consumed it (even if the resulting claim itself then failed), all
   * return `session_not_found` — this module has no opinion on how that
   * maps to HTTP (see `apis/frontend/routes/component-sessions.ts`, which
   * 404s it the same as every other lookup miss on this plane).
   */
  claimDomain(
    sessionToken: string,
    domain: string,
  ): Promise<ClaimWithSessionResult>
}

export function createComponentSessionsService(
  repository: ComponentSessionsRepository,
  domainsService: DomainsService,
  /** Clock, injected for deterministic tests. Default `() => new Date()`. */
  now: () => Date = () => new Date(),
): ComponentSessionsService {
  return {
    async createSession({ projectId, mode, externalId }) {
      const expiresAt = new Date(now().getTime() + SESSION_TTL_MS)
      const sessionToken = generateToken()

      await repository.create({
        projectId,
        mode,
        externalId,
        token: sessionToken,
        expiresAt,
      })

      return { sessionToken, expiresAt }
    },

    async claimDomain(sessionToken, domain) {
      const session = await repository.consumeIfAvailable(sessionToken, now())
      if (!session) {
        return { ok: false, error: 'session_not_found' }
      }

      return domainsService.claimDomain({
        projectId: session.projectId,
        mode: session.mode,
        domain,
        externalId: session.externalId ?? undefined,
      })
    },
  }
}
