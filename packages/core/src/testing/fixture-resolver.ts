import type {
  DnsResolver,
  TxtResolution,
  TxtResolutionFailureReason,
} from '../resolver'

/**
 * Simulates a resolver failure for a fixture hostname. `no_records` isn't
 * part of this type — it's represented by setting a hostname to an empty
 * array instead, since "the zone exists with zero TXT records" and "the
 * zone doesn't exist" are both things a fixture needs to express with a
 * records-shaped value, not an error-shaped one.
 */
export type FixtureError = {
  error: Exclude<TxtResolutionFailureReason, 'no_records'>
}

/**
 * A fixture entry is either the list of TXT records to hand back (an empty
 * array simulates `no_records`) or a {@link FixtureError} simulating
 * `nxdomain` / `timeout` / `server_failure`.
 */
export type FixtureZone = string[] | FixtureError

/**
 * In-memory {@link DnsResolver} for tests and the `.test` sandbox domain
 * flow. Never touches real DNS — every answer comes from the `zones` map
 * supplied at creation time (and any later {@link FixtureResolver.set}
 * calls), so scenarios like "record appears mid-poll" or "record lapses"
 * are just a mutation between two `resolveTxt` calls.
 */
export interface FixtureResolver extends DnsResolver {
  /**
   * Every hostname passed to `resolveTxt`, in call order. Lets tests assert
   * exactly what was queried (and how many times) without instrumenting the
   * resolver themselves.
   */
  readonly calls: string[]

  /**
   * Adds or replaces the fixture entry for `hostname`. Use this between
   * calls to `checkTxt` to simulate a record appearing (pending -> verified)
   * or disappearing/changing (verified -> lapsed).
   */
  set(hostname: string, entry: FixtureZone): void
}

function isFixtureError(entry: FixtureZone): entry is FixtureError {
  return !Array.isArray(entry)
}

/**
 * Creates a {@link FixtureResolver} seeded with `zones`. A hostname missing
 * from `zones` (and never added via {@link FixtureResolver.set}) resolves as
 * `nxdomain` by default — that's the honest default for "we don't have a
 * fixture entry for this", and matches what a real resolver would report
 * for a hostname that was never delegated.
 */
export function createFixtureResolver(
  zones: Record<string, FixtureZone> = {},
): FixtureResolver {
  const state = new Map<string, FixtureZone>(Object.entries(zones))
  const calls: string[] = []

  async function resolveTxt(hostname: string): Promise<TxtResolution> {
    calls.push(hostname)

    const entry = state.get(hostname)
    if (entry === undefined) {
      return { ok: false, reason: 'nxdomain' }
    }

    if (isFixtureError(entry)) {
      return { ok: false, reason: entry.error }
    }

    if (entry.length === 0) {
      return { ok: false, reason: 'no_records' }
    }

    return { ok: true, records: entry }
  }

  return {
    calls,
    resolveTxt,
    set(hostname: string, entry: FixtureZone): void {
      state.set(hostname, entry)
    },
  }
}
