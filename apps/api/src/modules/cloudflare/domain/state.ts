import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * How long a signed `state` stays valid after `signState` mints it — long
 * enough for a person to land on Cloudflare's consent screen and click
 * through, short enough that a leaked or abandoned `state` (browser
 * history, a proxy log) stops being useful quickly. There is no
 * server-side store to revoke a `state` early or mark one as spent — see
 * this module's own doc comment for why that's an accepted tradeoff, not
 * an oversight.
 */
export const STATE_TTL_MS = 10 * 60 * 1000

/**
 * Everything the callback needs to resume the flow the authorize redirect
 * started, carried entirely inside the signed `state` string rather than
 * a server-side session: which claim this grant applies to
 * (`frontendToken`, the same credential the hosted page itself uses — see
 * `infra/db/schema.ts`'s doc comment) and the PKCE `codeVerifier` the
 * authorize request's `code_challenge` was derived from.
 */
export interface CloudflareStatePayload {
  frontendToken: string
  codeVerifier: string
}

interface SignedStatePayload extends CloudflareStatePayload {
  /** Unix ms when `signState` minted this state — the clock `verifyState`'s expiry check is measured from. */
  issuedAt: number
}

export type VerifyStateResult =
  | { ok: true; payload: CloudflareStatePayload }
  | { ok: false; reason: 'invalid' | 'expired' }

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

/**
 * Signs `payload` into an opaque, URL-safe `state` string: a base64url JSON
 * envelope plus an HMAC-SHA256 signature over it, in the
 * `<payload>.<signature>` shape — the same "sign what you can't afford to
 * store" approach as a JWT, minus the header/algorithm-negotiation surface
 * a full JWT library brings, since this module only ever produces and
 * consumes its own state with one fixed algorithm.
 *
 * `secret` is `env.CLOUDFLARE_OAUTH_CLIENT_SECRET` (see `service.ts`) —
 * reusing it as the HMAC key means no separate signing secret needs to be
 * provisioned or documented; whoever could forge a `state` could already
 * exchange codes with Cloudflare directly, so this doesn't weaken anything.
 */
export function signState(
  payload: CloudflareStatePayload,
  secret: string,
  now: () => Date = () => new Date(),
): string {
  const full: SignedStatePayload = { ...payload, issuedAt: now().getTime() }
  const encodedPayload = base64UrlEncode(JSON.stringify(full))
  const signature = sign(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

/**
 * Verifies a `state` string produced by `signState`: checks the HMAC
 * signature (constant-time, via `timingSafeEqual`) and that it hasn't
 * outlived {@link STATE_TTL_MS}. `'invalid'` covers every integrity
 * failure identically (malformed shape, wrong secret, tampered payload,
 * tampered signature) — a caller has no legitimate reason to distinguish
 * them, and doing so would just hand an attacker a tampering oracle.
 *
 * Deliberately does not enforce single-use: there is no server-side store
 * to mark a `state` as spent (see this module's own doc comment on why —
 * the whole flow is designed to persist nothing between the authorize
 * redirect and the callback). Replaying a valid, unexpired `state` without
 * also supplying a still-valid Cloudflare authorization `code` fails at
 * `CloudflareClient.exchangeCode` regardless, since Cloudflare's own codes
 * are single-use — that's where this flow's actual replay protection
 * lives.
 */
export function verifyState(
  state: string,
  secret: string,
  now: () => Date = () => new Date(),
): VerifyStateResult {
  const separatorIndex = state.indexOf('.')
  if (separatorIndex === -1) {
    return { ok: false, reason: 'invalid' }
  }

  const encodedPayload = state.slice(0, separatorIndex)
  const signature = state.slice(separatorIndex + 1)
  const expectedSignature = sign(encodedPayload, secret)

  const signatureBuffer = Buffer.from(signature, 'base64url')
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url')
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: 'invalid' }
  }

  let parsed: SignedStatePayload
  try {
    parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as SignedStatePayload
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  if (
    typeof parsed.frontendToken !== 'string' ||
    typeof parsed.codeVerifier !== 'string' ||
    typeof parsed.issuedAt !== 'number'
  ) {
    return { ok: false, reason: 'invalid' }
  }

  if (now().getTime() - parsed.issuedAt >= STATE_TTL_MS) {
    return { ok: false, reason: 'expired' }
  }

  return {
    ok: true,
    payload: {
      frontendToken: parsed.frontendToken,
      codeVerifier: parsed.codeVerifier,
    },
  }
}
