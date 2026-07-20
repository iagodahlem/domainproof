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

/** What a verified session proves: who's making the request. */
export interface SessionClaims {
  userId: string;
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
  | { ok: false; reason: "invalid_or_expired" | "missing_subject" };

/**
 * Verifies a bearer token from the `Authorization` header and resolves the
 * session it proves. Implementations must never throw — every failure mode
 * is a value in {@link SessionVerifyResult}, mirroring the `DnsResolver`/
 * `HttpFetcher` contract in `packages/core`.
 */
export interface SessionVerifier {
  verify(token: string): Promise<SessionVerifyResult>;
}
