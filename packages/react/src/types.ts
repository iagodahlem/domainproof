/**
 * A domain's position in DomainProof's verification pipeline. Mirrors
 * `@domainproof/core`'s `DomainStatus` — duplicated rather than imported
 * because this package ships to consumers who never have that workspace
 * package installed (see `apps/api/src/apis/frontend/routes/verifications.ts`'s
 * `serializeVerification`, the source of truth this wire shape is kept in
 * sync with).
 *
 * - `not_started` — claimed but no verification challenge issued yet.
 * - `pending` — challenge issued; waiting for the DNS record to be
 *   published and to propagate.
 * - `verified` — the record was found and matched.
 * - `temporarily_failed` — a previously verified domain's record went
 *   missing or changed; it has a 72h grace window to recover before
 *   dropping to `failed`.
 * - `failed` — the verification window elapsed, or the grace window did,
 *   with no passing check.
 */
export type DomainStatus =
  'not_started' | 'pending' | 'verified' | 'temporarily_failed' | 'failed'

/** The DNS provider detected for a claimed domain, from its nameservers — `'unknown'` for every provider that isn't Cloudflare, including every `.test` sandbox domain. */
export type Provider = 'cloudflare' | 'unknown'

/** One instruction for the record to publish — currently always a `TXT` record. */
export interface VerificationRecord {
  label: string
  type: string
  value: string
}

/**
 * The outcome of the most recent verification attempt for a domain.
 * Widened to `string` rather than a literal union — same deliberate choice
 * as the API's own `LastCheckSummary` — so this is never a compiler-checked
 * exhaustive type, just documentation of what it's expected to carry:
 * `found`, `wrong_value`, `not_found`, `unreachable`, or `expired`.
 */
export interface VerificationCheck {
  outcome: string
  checkedAt: string
  /** Present only when `outcome` is `'wrong_value'`. */
  expected?: string
  /** Present only when `outcome` is `'wrong_value'`. */
  detected?: string[]
}

/**
 * A domain claim's verification, as returned by `GET
 * /frontend/verifications/:token` and `POST
 * /frontend/verifications/:token/check`.
 */
export interface Verification {
  domain: string
  mode: 'test' | 'live'
  status: DomainStatus
  projectName: string
  provider: Provider
  records: VerificationRecord[]
  check: VerificationCheck | null
  updatedAt: string
}

/**
 * The result of spending a component session — the exact same shape as
 * {@link Verification}, plus the new claim's own `frontendToken` (see
 * `POST /frontend/component-sessions/:sessionToken/claim`). Every
 * subsequent status read/recheck uses this `frontendToken`, not the spent
 * `sessionToken`.
 */
export interface ClaimResult extends Verification {
  frontendToken: string
}

/**
 * The frontend plane's `{ error: { code, message } }` taxonomy, plus a
 * `network` kind for a `fetch` that never got an HTTP response at all
 * (connection refused, DNS failure, offline) — the two need different
 * handling: an http error means the request reached DomainProof and it
 * said no, a network error means "try again."
 */
export type DomainProofError =
  | { kind: 'http'; status: number; code: string; message: string }
  | { kind: 'network'; message: string }
