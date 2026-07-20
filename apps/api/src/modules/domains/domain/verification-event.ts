import type {
  DomainStatus,
  TxtCheckResult,
  VerificationEvent,
} from '@domainproof/core'

/**
 * Throws only on a type-system violation (a `DomainStatus` the switch below
 * doesn't know about) — unreachable at runtime as long as the switch stays
 * exhaustive. Mirrors the `assertNever` pattern used throughout
 * `@domainproof/core`.
 */
function assertNever(value: never): never {
  throw new Error(
    `Unhandled domain status in eventForCheckOutcome: ${JSON.stringify(value)}`,
  )
}

/**
 * Maps a DNS check's outcome (core's `checkTxt`) onto the `VerificationEvent`
 * `verifyDomain` should feed into core's `transition()` — the one place a
 * verification attempt decides "does this change the domain's status, and
 * how". Deliberately owned by this module rather than `packages/core`:
 * core's state machine only consumes events, it never decides what a DNS
 * check outcome *means* (see `states.ts`'s doc comment); that meaning is
 * DomainProof-specific business logic, so it lives here.
 *
 * Returns `undefined` when the outcome shouldn't drive any transition — the
 * attempt is still recorded by the caller, the domain just stays exactly
 * where it was. Every event this function returns is guaranteed legal for
 * the given `status` (verified by this file's own tests against
 * `transition()`), so a caller can treat an `undefined` result and an
 * `{ ok: false }` from `transition()` as equivalent "no-op" cases.
 *
 * The mapping, by current status:
 *
 * - **`not_started`** — never proposes a transition. A domain only reaches
 *   `verifyDomain` once it has an active challenge, which `claimDomain`
 *   only ever issues alongside an immediate `not_started` -> `pending`
 *   transition — so a challenge existing at all means status is already at
 *   least `pending` in practice. Handled defensively rather than assumed.
 * - **`pending`** — `found` passes verification (`check_passed`).
 *   `wrong_value` is treated as a hard failure (`check_hard_failed`): a
 *   syntactically valid but incorrect record is actionable, wrong-looking
 *   information, not "not there yet". `not_found` stays pending — DNS
 *   propagation, not a failure — recorded without transitioning.
 * - **`verified`** — `found` is a no-op refresh (`recheck_passed`).
 *   `wrong_value` and `not_found` both mean "the record verified DNS is now
 *   flagging isn't right anymore", which states.ts documents as one event,
 *   `recheck_record_lost` (-> `temporarily_failed`, opening the 72h grace
 *   window) — DNS can't distinguish "record removed" from "record replaced
 *   with garbage" and neither should this mapping.
 * - **`temporarily_failed`** — `found` recovers straight back to `verified`
 *   (`recheck_passed`). `wrong_value` and `not_found` don't transition:
 *   the state machine's only "grace window closed" event is
 *   `grace_expired`, which is caller-timed (a scheduled sweep, not
 *   something a single check attempt decides) and out of scope here — the
 *   attempt is recorded, the domain stays in its grace window.
 * - **`failed`** — never proposes a transition. The state machine's only
 *   way out of `failed` is `challenge_regenerated` (a fresh token), not a
 *   passing check against the old one — so even a `found` outcome here
 *   doesn't resurrect the domain on its own.
 *
 * `unreachable` never proposes a transition, regardless of status: it means
 * "we don't know", not "here's a definitive answer" — see `checkTxt`'s doc
 * comment. Only a definitive outcome (`found` / `wrong_value` / `not_found`)
 * can drive a state change.
 */
export function eventForCheckOutcome(
  status: DomainStatus,
  outcome: TxtCheckResult['outcome'],
): VerificationEvent | undefined {
  if (outcome === 'unreachable') {
    return undefined
  }

  switch (status) {
    case 'not_started':
      return undefined

    case 'pending':
      if (outcome === 'found') {
        return { type: 'check_passed' }
      }
      if (outcome === 'wrong_value') {
        return { type: 'check_hard_failed' }
      }
      return undefined // not_found

    case 'verified':
      if (outcome === 'found') {
        return { type: 'recheck_passed' }
      }
      return { type: 'recheck_record_lost' } // wrong_value | not_found

    case 'temporarily_failed':
      if (outcome === 'found') {
        return { type: 'recheck_passed' }
      }
      return undefined // wrong_value | not_found

    case 'failed':
      return undefined

    default:
      return assertNever(status)
  }
}
