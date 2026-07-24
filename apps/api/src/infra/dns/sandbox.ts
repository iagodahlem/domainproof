import {
  normalizeDomain,
  registrableDomain,
  recordValue,
  type DnsResolver,
  type TxtResolution,
} from '@domainproof/core'

// RFC 6761 permanently reserves `.test` for documentation and testing, so it
// can never be delegated in real DNS or collide with a real owner's domain
// (see domain.ts). That's what makes it safe to answer entirely in-memory,
// with no real DNS IO anywhere in this module.
const SANDBOX_TLD = 'test'

/**
 * How long a `pending-then-verified` journey stays nxdomain before the
 * correct record "appears". Long enough to feel like real propagation delay
 * on the hosted page's polling UI, short enough that a reviewer isn't
 * sitting around during a demo — tuned for the onboarding walkthrough's
 * active auto-check poll (see `ClaimedDomainWalkthrough` in
 * `onboarding-panel.tsx`), which lands its third tick around this mark.
 */
const PENDING_PROPAGATION_MS = 12_000

/** Width of a `flaky` journey's alternating reachable/unreachable windows. */
const FLAKY_WINDOW_MS = 30_000

/**
 * Deterministic, obviously-fake token for the `wrong-value` journey.
 * Deliberately not base32-random-looking (real tokens come from
 * {@link generateToken} and never repeat a single character run this long),
 * so it can never coincidentally equal a real generated token, while still
 * parsing as a syntactically valid DomainProof record value.
 */
const WRONG_VALUE_TOKEN = 'wrongwrongwrongwrongwrongw'

/**
 * The catalog of magic sandbox journeys, keyed by the label a `.test` domain
 * carries before any `+suffix` (see {@link sandboxJourneyFor}). Each entry
 * documents exactly how {@link createSandboxResolver} answers `resolveTxt`
 * for that journey as a function of elapsed time since the challenge was
 * created — this table is the contract; `createSandboxResolver`'s switch is
 * the implementation, and the two are kept in sync by the exhaustive
 * `assertNever` check at its default case.
 *
 * | journey                  | resolveTxt behavior over elapsed time         |
 * |--------------------------|------------------------------------------------|
 * | `verified`               | Correct record from the first check.          |
 * | `pending-then-verified`  | nxdomain until 12s elapsed, then correct.     |
 * | `wrong-value`            | Always a valid-looking but wrong record.      |
 * | `nxdomain`               | nxdomain forever.                             |
 * | `flaky`                  | Starts unreachable, alternates every 30s.     |
 * | `conflict`               | Correct record immediately, like `verified`.  |
 */
export const SANDBOX_JOURNEYS = {
  verified:
    'The correct record is present immediately: resolveTxt returns the ' +
    "challenge's record value from the very first check. Models a domain " +
    'owner who published the record before starting verification.',
  'pending-then-verified':
    'nxdomain until 12 seconds have elapsed since the challenge was ' +
    'created, then the correct record appears. Models real-world DNS ' +
    "propagation delay: long enough to read as real on the hosted page's " +
    'polling UI, short enough to still fit inside a live demo.',
  'wrong-value':
    'Always returns a syntactically valid DomainProof record, but with a ' +
    'deterministic, clearly-fake token that never matches the real one — ' +
    'checkTxt reports wrong_value with the detected (wrong) token, letting ' +
    'the UI render an expected-vs-detected diff.',
  nxdomain:
    'nxdomain forever. Models a domain owner who never added the record.',
  flaky:
    'Deterministic alternation by elapsed 30-second windows: starts ' +
    'unreachable (a timeout) during even-numbered windows, then the ' +
    'correct record during odd-numbered windows. Drives the ' +
    'temporarily_failed grace-window story and its recovery UX.',
  conflict:
    'Resolves the correct record immediately, exactly like verified — DNS ' +
    "has no notion of 'this domain is already claimed by another account'. " +
    "That meaning is enforced by the API's claim layer when it tries to " +
    'assign a verified domain to an account, not simulated here in DNS.',
} as const

export type SandboxJourney = keyof typeof SANDBOX_JOURNEYS

function isSandboxJourney(value: string): value is SandboxJourney {
  return Object.hasOwn(SANDBOX_JOURNEYS, value)
}

/**
 * Failure reasons {@link sandboxJourneyFor} can report, discriminated by
 * `ok`:
 *
 * - `not_sandbox` — `domain` isn't a `.test` sandbox domain at all (fails
 *   {@link normalizeDomain} or its TLD isn't `test`).
 * - `unknown_journey` — it's a `.test` domain, but its label doesn't match
 *   any entry in {@link SANDBOX_JOURNEYS} (e.g. someone claims
 *   `random-name.test`).
 */
export type SandboxJourneyResult =
  | { ok: true; journey: SandboxJourney }
  | { ok: false; reason: 'not_sandbox' | 'unknown_journey' }

/**
 * Parses the sandbox journey out of a `.test` domain's first label, with any
 * `+suffix` stripped — e.g. `pending-then-verified+run2.test` names the
 * `pending-then-verified` journey. The `+suffix` exists so parallel demo
 * runs (or parallel tests) can each get their own independent domain while
 * sharing one journey's behavior; it carries no meaning of its own.
 */
export function sandboxJourneyFor(domain: string): SandboxJourneyResult {
  const normalized = normalizeDomain(domain)
  if (!normalized.ok) {
    return { ok: false, reason: 'not_sandbox' }
  }

  const registrable = registrableDomain(normalized.domain)
  if (!registrable.endsWith(`.${SANDBOX_TLD}`)) {
    return { ok: false, reason: 'not_sandbox' }
  }

  const label = registrable.slice(0, -(SANDBOX_TLD.length + 1))
  const journeyLabel = label.split('+')[0] ?? label

  if (isSandboxJourney(journeyLabel)) {
    return { ok: true, journey: journeyLabel }
  }
  return { ok: false, reason: 'unknown_journey' }
}

/**
 * The challenge a sandbox resolver answers for: the exact TXT hostname it
 * will respond to, the record value that counts as "correct" for that
 * challenge, the brand the challenge was issued under (used to fabricate a
 * syntactically valid but wrong record for the `wrong-value` journey — see
 * {@link resolveForJourney}), and when the challenge was issued (the clock
 * origin every journey's elapsed-time behavior is measured from).
 */
export interface SandboxChallenge {
  recordHost: string
  recordValue: string
  brandSlug: string
  createdAt: Date
}

/**
 * A `recordHost` is always `_<brandSlug>-challenge.<domain>` (see
 * `challengeHost` in core's record.ts) — everything after the first label
 * is the domain the journey is parsed from.
 */
function domainFromRecordHost(recordHost: string): string {
  const firstDotIndex = recordHost.indexOf('.')
  return firstDotIndex === -1 ? recordHost : recordHost.slice(firstDotIndex + 1)
}

/**
 * Throws only on a type-system violation (a journey the switch below doesn't
 * know about) — unreachable at runtime as long as the switch stays
 * exhaustive. Mirrors the `assertNever` pattern in states.ts / check-txt.ts.
 */
function assertNever(value: never): never {
  throw new Error(
    `Unhandled sandbox journey in createSandboxResolver: ${JSON.stringify(value)}`,
  )
}

function resolveForJourney(
  journey: SandboxJourney,
  challenge: SandboxChallenge,
  elapsedMs: number,
): TxtResolution {
  switch (journey) {
    case 'verified':
    case 'conflict':
      return { ok: true, records: [challenge.recordValue] }

    case 'pending-then-verified':
      return elapsedMs >= PENDING_PROPAGATION_MS
        ? { ok: true, records: [challenge.recordValue] }
        : { ok: false, reason: 'nxdomain' }

    case 'wrong-value':
      return {
        ok: true,
        records: [recordValue(WRONG_VALUE_TOKEN, challenge.brandSlug)],
      }

    case 'nxdomain':
      return { ok: false, reason: 'nxdomain' }

    case 'flaky': {
      const windowIndex = Math.floor(elapsedMs / FLAKY_WINDOW_MS)
      return windowIndex % 2 === 0
        ? { ok: false, reason: 'timeout' }
        : { ok: true, records: [challenge.recordValue] }
    }

    default:
      return assertNever(journey)
  }
}

/**
 * Builds an in-memory {@link DnsResolver} that deterministically simulates
 * one verification challenge's `.test` sandbox journey — no real DNS IO, no
 * `Date.now()` (the clock is always the injected `now`), no randomness.
 *
 * The sandbox is deliberately just another `DnsResolver` implementation: it
 * plugs into the exact same `checkTxt` / state machine / API verify pipeline
 * that a real resolver does, so there is no parallel "sandbox mode" code
 * path anywhere above this boundary — only a different answer to
 * `resolveTxt`.
 *
 * The returned resolver answers only for `challenge.recordHost`; any other
 * hostname resolves as `nxdomain`. That's intentional, not a limitation to
 * fix — a sandbox resolver is constructed per-verification to answer for one
 * challenge, not to simulate an entire zone.
 *
 * The journey is parsed from the domain embedded in `challenge.recordHost`
 * (see {@link domainFromRecordHost}). If that domain isn't a known journey —
 * someone claims `random-name.test` — this falls back to the `nxdomain`
 * behavior: the safest, most honest simulation of "we don't have a fixture
 * for this", and exactly what a real resolver reports for a domain whose
 * record was never added.
 */
export function createSandboxResolver(
  challenge: SandboxChallenge,
  now: () => Date,
): DnsResolver {
  async function resolveTxt(hostname: string): Promise<TxtResolution> {
    if (hostname !== challenge.recordHost) {
      return { ok: false, reason: 'nxdomain' }
    }

    const journeyResult = sandboxJourneyFor(
      domainFromRecordHost(challenge.recordHost),
    )
    const journey = journeyResult.ok ? journeyResult.journey : 'nxdomain'
    const elapsedMs = now().getTime() - challenge.createdAt.getTime()

    return resolveForJourney(journey, challenge, elapsedMs)
  }

  return { resolveTxt }
}
