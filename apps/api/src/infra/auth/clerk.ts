import { createRemoteJWKSet, jwtVerify } from 'jose'
import type {
  SessionVerifier,
  SessionVerifyResult,
} from '@modules/accounts/ports'

export interface ClerkSessionVerifierConfig {
  /** JWKS endpoint for the Clerk instance, e.g. env `CLERK_JWKS_URL`. */
  jwksUrl: string
  /** Expected `iss` claim, e.g. env `CLERK_ISSUER`. */
  issuer: string
}

/**
 * The only file in this api allowed to talk to Clerk directly — implements
 * the accounts module's {@link SessionVerifier} port over a Clerk-issued
 * JWT verified against Clerk's JWKS. Everything above this module (the
 * auth middleware, routes, tests) depends on the port, never on this
 * concrete adapter.
 *
 * Never throws: a bad signature, wrong issuer, expired token, or missing
 * subject claim all come back as a value in {@link SessionVerifyResult},
 * matching the port's contract.
 */
export function createClerkSessionVerifier(
  config: ClerkSessionVerifierConfig,
): SessionVerifier {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl))

  return {
    async verify(token: string): Promise<SessionVerifyResult> {
      let payload
      try {
        ;({ payload } = await jwtVerify(token, jwks, { issuer: config.issuer }))
      } catch {
        return { ok: false, reason: 'invalid_or_expired' }
      }

      if (!payload.sub) {
        return { ok: false, reason: 'missing_subject' }
      }

      // Confirmed empirically (FD-021 A2's e2e signup-flow suite, which
      // decodes a real dev-instance session token): this instance's v2
      // session token already carries an `email` key by default — no
      // custom claim config needed. It's `null` rather than a string for
      // any user with no email address attached, which is every user on
      // this dev instance right now (the Backend API 403s attaching one —
      // "Email address" is disabled instance-wide, Google-only per D-043),
      // so the `typeof` guard below still matters: it's what turns that
      // `null` into `undefined` rather than a literal `"null"`. See
      // `modules/accounts/service.ts`'s `ensureAccount` for the fallback
      // when it's absent.
      const email =
        typeof payload.email === 'string' ? payload.email : undefined

      return { ok: true, claims: { userId: payload.sub, email } }
    },
  }
}
