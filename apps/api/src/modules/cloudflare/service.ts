import {
  codeChallengeFromVerifier,
  generateCodeVerifier,
  registrableDomain,
} from '@domainproof/core'
import type { DomainsService } from '@modules/domains/service'
import type { EventBus } from '@shared/events'
import { signState, verifyState } from './domain/state'
import type { CloudflareClient } from './ports'

/** Cloudflare's self-managed OAuth authorize endpoint — see `infra/cloudflare/oauth-client.ts`'s `OAUTH_TOKEN_URL` for the token-exchange half. */
const CLOUDFLARE_AUTHORIZE_URL = 'https://dash.cloudflare.com/oauth2/auth'

/**
 * The OAuth scopes this flow requests: read access to list/match a zone,
 * edit access to create the TXT record in it. Cloudflare scopes map 1:1
 * onto its API token permission names (Zone > Zone > Read, Zone > DNS >
 * Edit) — confirm these two strings against `GET /client/v4/oauth/scopes`
 * when the real OAuth client is created (see README's Cloudflare setup
 * section), since Cloudflare's dashboard UI picks permissions by
 * checkbox, not by typing this literal string.
 */
const CLOUDFLARE_OAUTH_SCOPES = ['zone.read', 'dns_records.edit']

export interface CloudflareOAuthServiceConfig {
  clientId: string
  clientSecret: string
  /** Must exactly match the redirect URI registered on the Cloudflare OAuth client. */
  redirectUri: string
}

/**
 * Every outcome `handleCallback` can redirect the hosted page back with.
 * `denied` (the user declined on Cloudflare's consent screen),
 * `exchange_failed` (no valid code, or Cloudflare rejected the code
 * exchange), `not_found` (the claim was released between the authorize
 * redirect and this callback), `no_matching_zone` (the authorizing
 * account has no zone for the claim's domain), `record_create_failed`
 * (Cloudflare accepted the grant but rejected the record write), and
 * `success` (the record was written and the standard verify path was
 * triggered — the hosted page's existing polling takes it from there).
 */
export type CloudflareCallbackOutcome =
  | 'success'
  | 'denied'
  | 'exchange_failed'
  | 'not_found'
  | 'no_matching_zone'
  | 'record_create_failed'

export type CloudflareCallbackResult =
  | { ok: true; frontendToken: string; outcome: CloudflareCallbackOutcome }
  /**
   * No safe redirect target exists: `state` is missing, expired, or fails
   * signature verification, so its `frontendToken` can't be trusted
   * enough to even build a redirect URL from. The route maps this to a
   * plain error response rather than attempting one.
   */
  | { ok: false; error: 'invalid_state' }

export interface CloudflareOAuthService {
  /** Builds the full Cloudflare authorize URL for one claim's one-click setup — PKCE challenge and signed state included. */
  buildAuthorizeUrl(frontendToken: string): string

  /**
   * Resolves a callback's `code`/`state`/`error` query params into a
   * redirect outcome. Never throws: every failure mode this flow can hit
   * — a denied grant, a failed exchange, no matching zone, a failed
   * record write, or the claim having vanished in the interim — comes
   * back as a typed `outcome`, not a rejected promise.
   *
   * The Cloudflare access token this exchanges for lives only in this
   * function's own local scope: it's never persisted, never logged, and
   * never appears in the returned result — see FD-023's grant-handling
   * constraint. Once this call returns, nothing in the process still
   * references it.
   */
  handleCallback(params: {
    code?: string
    state?: string
    error?: string
  }): Promise<CloudflareCallbackResult>
}

export function createCloudflareOAuthService(
  config: CloudflareOAuthServiceConfig,
  cloudflareClient: CloudflareClient,
  domainsService: DomainsService,
  eventBus: EventBus,
  /** Clock, injected for deterministic tests (drives signed-state issuance time). Default `() => new Date()`. */
  now: () => Date = () => new Date(),
): CloudflareOAuthService {
  return {
    buildAuthorizeUrl(frontendToken) {
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = codeChallengeFromVerifier(codeVerifier)
      const state = signState(
        { frontendToken, codeVerifier },
        config.clientSecret,
        now,
      )

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: CLOUDFLARE_OAUTH_SCOPES.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      })

      return `${CLOUDFLARE_AUTHORIZE_URL}?${params.toString()}`
    },

    async handleCallback({ code, state, error }) {
      if (!state) {
        return { ok: false, error: 'invalid_state' }
      }

      const verified = verifyState(state, config.clientSecret, now)
      if (!verified.ok) {
        return { ok: false, error: 'invalid_state' }
      }

      const { frontendToken, codeVerifier } = verified.payload

      if (error) {
        return { ok: true, frontendToken, outcome: 'denied' }
      }
      if (!code) {
        return { ok: true, frontendToken, outcome: 'exchange_failed' }
      }

      const exchange = await cloudflareClient.exchangeCode({
        code,
        codeVerifier,
      })
      if (!exchange.ok) {
        return { ok: true, frontendToken, outcome: 'exchange_failed' }
      }
      const { accessToken } = exchange

      const domain =
        await domainsService.getDomainByFrontendToken(frontendToken)
      if (!domain) {
        return { ok: true, frontendToken, outcome: 'not_found' }
      }

      const [challenge] = domain.challenges
      if (!challenge) {
        // Cannot happen: claimDomain always creates a challenge alongside
        // the domain, in the same transaction (see
        // `modules/domains/service.ts`'s identical guard in `verifyRow`).
        return { ok: true, frontendToken, outcome: 'record_create_failed' }
      }

      const zoneResult = await cloudflareClient.findZoneByName(
        accessToken,
        registrableDomain(domain.domain),
      )
      if (!zoneResult.ok) {
        return { ok: true, frontendToken, outcome: 'no_matching_zone' }
      }

      const createResult = await cloudflareClient.createTxtRecord(
        accessToken,
        zoneResult.zone.id,
        { name: challenge.recordHost, content: challenge.recordValue },
      )
      if (!createResult.ok) {
        return { ok: true, frontendToken, outcome: 'record_create_failed' }
      }

      await eventBus.publish('domain.dns_autoconfigured', {
        domainId: domain.id,
        projectId: domain.projectId,
        mode: domain.mode,
        domain: domain.domain,
        externalId: domain.externalId,
        provider: 'cloudflare',
        recordType: 'TXT',
      })

      // Best-effort: this claim was just resolved above, so `not_found`
      // here would only mean a concurrent release raced this request —
      // the record write already succeeded regardless, and the hosted
      // page's own polling (or the background recheck worker) picks up
      // the resulting status either way.
      await domainsService.verifyDomainByFrontendToken(frontendToken)

      return { ok: true, frontendToken, outcome: 'success' }
    },
  }
}
