/**
 * The injected boundary for verifying a login session token. This is a
 * module-owned port (unlike `DnsResolver`/`HttpFetcher`, which are owned by
 * `packages/core` because DNS/HTTP checks are domain-wide) — "verify a
 * session" is specific to how this api authenticates the dashboard, so the
 * accounts module owns the shape of that question.
 *
 * The concrete implementation (today: Clerk, via JWKS + JWT verification)
 * lives in `apps/api/src/infra/auth/` — this module never imports a vendor
 * SDK or calls a vendor directly, the same way `modules/*` never reaches
 * into `infra/dns` or `infra/http`.
 */

/**
 * What a verified session proves: who's making the request, plus whatever
 * profile fields the token happens to carry. `email` is `undefined` unless
 * the Clerk instance is configured to include it as a session token claim
 * (this repo's Clerk instance isn't, today) — see
 * `modules/accounts/service.ts`'s `ensureAccount` for the fallback when
 * it's absent.
 */
export interface SessionClaims {
  userId: string
  email?: string
}

/**
 * Failure reasons a {@link SessionVerifier} can report, discriminated by
 * `ok`:
 *
 * - `invalid_or_expired` — the token failed verification outright (bad
 *   signature, wrong issuer, expired, malformed).
 * - `missing_subject` — the token verified but carries no subject claim,
 *   so there's no user id to authenticate as.
 */
export type SessionVerifyResult =
  | { ok: true; claims: SessionClaims }
  | { ok: false; reason: 'invalid_or_expired' | 'missing_subject' }

/**
 * Verifies a bearer token from the `Authorization` header and resolves the
 * session it proves. Implementations must never throw — every failure mode
 * is a value in {@link SessionVerifyResult}, mirroring the `DnsResolver`/
 * `HttpFetcher` contract in `packages/core`.
 */
export interface SessionVerifier {
  verify(token: string): Promise<SessionVerifyResult>
}

/**
 * Resolves a Clerk user's email address when it isn't already present on
 * the verified session claims — e.g. via Clerk's backend API. A module-
 * owned port (same reasoning as `SessionVerifier`): "resolve this user's
 * email" is specific to how this api bootstraps accounts, not a
 * domain-wide concept.
 *
 * Must never throw: a resolution failure (no backend credentials
 * configured, the lookup itself failing, no email on the Clerk user) comes
 * back as `undefined`, and `ensureAccount` logs and continues without an
 * email rather than blocking account bootstrap on it — see
 * `modules/accounts/service.ts`.
 */
export interface AccountEmailResolver {
  resolveEmail(clerkUserId: string): Promise<string | undefined>
}
