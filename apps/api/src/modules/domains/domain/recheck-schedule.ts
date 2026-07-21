import type { DomainStatus } from '@domainproof/core'

/** The last (steady-state) rung of the pending backoff ladder — see {@link pendingBackoffMs}. */
const LAST_PENDING_RUNG = 4

/**
 * Escalating backoff for a still-`pending` domain: 1m, 5m, 15m, 1h, then
 * every 6h thereafter. `rung` is how many consecutive checks have found
 * the domain still `pending` (see {@link computeRecheckSchedule}'s
 * `checkAttempts` handling), clamped to {@link LAST_PENDING_RUNG} — a
 * fresh challenge (rung 0) is checked soon after issuance, on the
 * assumption DNS propagation is often quick, and backs off as it keeps
 * not showing up. A `switch` over a small literal union rather than an
 * array lookup, so indexing never needs an unsafe cast or a fallback for
 * "index out of bounds" that can't actually happen.
 */
function pendingBackoffMs(rung: 0 | 1 | 2 | 3 | 4): number {
  switch (rung) {
    case 0:
      return 60_000 // 1m
    case 1:
      return 5 * 60_000 // 5m
    case 2:
      return 15 * 60_000 // 15m
    case 3:
      return 60 * 60_000 // 1h
    case 4:
      return 6 * 60 * 60_000 // 6h (repeats for every rung beyond this one)
  }
}

/**
 * How often a `temporarily_failed` domain is re-checked while its grace
 * window is still open. More frequent than the pending ladder's steady
 * state (6h) so a real recovery (the owner re-adds a record they
 * accidentally removed) is caught quickly rather than waiting out most of
 * the 72h window.
 */
const TEMPORARILY_FAILED_RECHECK_MS = 15 * 60_000 // 15m

/**
 * How often an already-`verified` domain is re-checked to catch a record
 * being removed or changed after the fact. Slow and steady — verified
 * domains are the common case and rarely change, so this is a background
 * safety net, not a tight polling loop.
 */
const VERIFIED_RECHECK_MS = 24 * 60 * 60 * 1000 // 24h

/**
 * The 72h window a `temporarily_failed` domain has to recover before the
 * scheduled worker expires it to `failed` (core's `grace_expired` event —
 * see `states.ts`). Deliberately a separate constant from core's
 * `DEFAULT_TOKEN_TTL_MS` (the *pending* verification window) even though
 * both happen to be 72h today: the two windows time conceptually
 * different things (a domain's first verification vs. an
 * already-verified domain's grace period) and are read by different code
 * paths — see `service.ts`'s `verifyDomain` doc comment.
 */
export const GRACE_WINDOW_MS = 72 * 60 * 60 * 1000

/**
 * The `next_check_at` a freshly claimed domain starts with — rung 0 of
 * {@link pendingBackoffMs}, measured from the claim itself rather than
 * from a first check that hasn't happened yet.
 */
export function firstPendingCheckAt(claimedAt: Date): Date {
  return new Date(claimedAt.getTime() + pendingBackoffMs(0))
}

export interface RecheckScheduleInput {
  previousStatus: DomainStatus
  nextStatus: DomainStatus
  /** When this check (or, for a grace expiry, this sweep) ran. */
  checkedAt: Date
  /** The domain's `checkAttempts` counter before this check. */
  previousCheckAttempts: number
}

export interface RecheckSchedule {
  /** `null` means "not scheduled" — `failed` domains have no automatic recheck. */
  nextCheckAt: Date | null
  /** The rung of {@link pendingBackoffMs} the domain now sits at; 0 once it leaves `pending`. */
  checkAttempts: number
  /**
   * `undefined` leaves the domain's `grace_expires_at` untouched (still
   * mid-window, or never relevant); `null` clears it (recovered, or just
   * expired); a `Date` sets it (just entered the grace window).
   */
  graceExpiresAt?: Date | null
}

/**
 * Pure due-ness bookkeeping for one status transition: when the domain
 * should be checked next, and (for `temporarily_failed`) when its grace
 * window closes. Shared by every caller that persists a status change —
 * `verifyDomain`'s two branches (a real DNS-check attempt, and the
 * pending-challenge-expiry short-circuit) and the scheduled worker's
 * grace-window expiry sweep — so due-ness policy lives in exactly one
 * place regardless of what triggered the transition.
 *
 * Depends only on the transition itself (`previousStatus` ->
 * `nextStatus`) and when it happened, never on *why* (a specific DNS
 * outcome) — due-ness is a function of state, not of how the domain got
 * there.
 */
export function computeRecheckSchedule(
  input: RecheckScheduleInput,
): RecheckSchedule {
  const { previousStatus, nextStatus, checkedAt, previousCheckAttempts } = input

  const checkAttempts =
    previousStatus === 'pending' && nextStatus === 'pending'
      ? previousCheckAttempts + 1
      : 0

  const graceExpiresAt =
    previousStatus !== 'temporarily_failed' &&
    nextStatus === 'temporarily_failed'
      ? new Date(checkedAt.getTime() + GRACE_WINDOW_MS)
      : previousStatus === 'temporarily_failed' &&
          nextStatus !== 'temporarily_failed'
        ? null
        : undefined

  switch (nextStatus) {
    case 'pending': {
      const rung = Math.min(checkAttempts, LAST_PENDING_RUNG) as
        0 | 1 | 2 | 3 | 4
      return {
        nextCheckAt: new Date(checkedAt.getTime() + pendingBackoffMs(rung)),
        checkAttempts,
        graceExpiresAt,
      }
    }
    case 'verified':
      return {
        nextCheckAt: new Date(checkedAt.getTime() + VERIFIED_RECHECK_MS),
        checkAttempts,
        graceExpiresAt,
      }
    case 'temporarily_failed':
      return {
        nextCheckAt: new Date(
          checkedAt.getTime() + TEMPORARILY_FAILED_RECHECK_MS,
        ),
        checkAttempts,
        graceExpiresAt,
      }
    case 'failed':
    case 'not_started':
      return { nextCheckAt: null, checkAttempts, graceExpiresAt }
    default: {
      const _exhaustive: never = nextStatus
      throw new Error(
        `Unhandled domain status in computeRecheckSchedule: ${JSON.stringify(_exhaustive)}`,
      )
    }
  }
}
