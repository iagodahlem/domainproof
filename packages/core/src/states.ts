/**
 * Domain verification statuses tracked across the DomainProof pipeline.
 */
export const DOMAIN_STATUSES = [
  "not_started",
  "pending",
  "verified",
  "temporarily_failed",
  "failed",
] as const;

export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

/**
 * Meaningful events the caller feeds into the state machine. This module
 * only consumes these — it does not decide when a check "passes" or
 * "fails" (that's the checker layer), and it does not read clocks: any
 * time-based decision (verification window expiry, grace window expiry)
 * arrives here as an event, not as a Date or timer.
 */
export type VerificationEvent =
  | { type: "verification_started" }
  | { type: "check_passed" }
  | { type: "check_hard_failed" }
  | { type: "recheck_passed" }
  | { type: "recheck_record_lost" }
  | { type: "grace_expired" }
  | { type: "challenge_regenerated" };

export type TransitionResult =
  | { ok: true; next: DomainStatus }
  | { ok: false; error: "invalid_transition" };

function invalidTransition(): TransitionResult {
  return { ok: false, error: "invalid_transition" };
}

/**
 * Throws only on a type-system violation (an event or status the exhaustive
 * switches below don't know about) — unreachable at runtime as long as the
 * switches stay exhaustive, since TypeScript refuses to compile a `never`
 * mismatch. Not part of {@link transition}'s public (non-throwing) contract.
 */
function assertNever(value: never): never {
  throw new Error(`Unhandled case in state machine: ${JSON.stringify(value)}`);
}

/**
 * Pure state transition function for domain verification status.
 *
 * - A challenge is issued once (`verification_started`) starting the
 *   verification window: `not_started` -> `pending`.
 * - `pending` resolves to `verified` on the first passing check, or to
 *   `failed` once the (caller-timed) verification window elapses with no
 *   correct record (`check_hard_failed`).
 * - `verified` domains are continuously re-checked: a passing recheck is a
 *   no-op refresh, a missing/wrong record opens a 72h grace window
 *   (`temporarily_failed`) rather than failing immediately.
 * - `temporarily_failed` is that grace window: a passing recheck recovers
 *   straight back to `verified`; if the window elapses with no recovery
 *   (`grace_expired`, timed by the caller) the domain becomes `failed`.
 * - `failed` and still-`pending` domains can get a fresh challenge token
 *   (`challenge_regenerated`), which (re)starts verification from `pending`.
 *
 * Never throws for a bad (status, event) pair — returns
 * `{ ok: false, error: 'invalid_transition' }` instead.
 */
export function transition(status: DomainStatus, event: VerificationEvent): TransitionResult {
  switch (status) {
    case "not_started":
      switch (event.type) {
        case "verification_started":
          return { ok: true, next: "pending" };
        case "check_passed":
        case "check_hard_failed":
        case "recheck_passed":
        case "recheck_record_lost":
        case "grace_expired":
        case "challenge_regenerated":
          return invalidTransition();
        default:
          return assertNever(event);
      }

    case "pending":
      switch (event.type) {
        case "check_passed":
          return { ok: true, next: "verified" };
        case "check_hard_failed":
          return { ok: true, next: "failed" };
        case "challenge_regenerated":
          return { ok: true, next: "pending" };
        case "verification_started":
        case "recheck_passed":
        case "recheck_record_lost":
        case "grace_expired":
          return invalidTransition();
        default:
          return assertNever(event);
      }

    case "verified":
      switch (event.type) {
        case "recheck_passed":
          return { ok: true, next: "verified" };
        case "recheck_record_lost":
          return { ok: true, next: "temporarily_failed" };
        case "verification_started":
        case "check_passed":
        case "check_hard_failed":
        case "grace_expired":
        case "challenge_regenerated":
          return invalidTransition();
        default:
          return assertNever(event);
      }

    case "temporarily_failed":
      switch (event.type) {
        case "recheck_passed":
          return { ok: true, next: "verified" };
        case "grace_expired":
          return { ok: true, next: "failed" };
        case "verification_started":
        case "check_passed":
        case "check_hard_failed":
        case "recheck_record_lost":
        case "challenge_regenerated":
          return invalidTransition();
        default:
          return assertNever(event);
      }

    case "failed":
      switch (event.type) {
        case "challenge_regenerated":
          return { ok: true, next: "pending" };
        case "verification_started":
        case "check_passed":
        case "check_hard_failed":
        case "recheck_passed":
        case "recheck_record_lost":
        case "grace_expired":
          return invalidTransition();
        default:
          return assertNever(event);
      }

    default:
      return assertNever(status);
  }
}
