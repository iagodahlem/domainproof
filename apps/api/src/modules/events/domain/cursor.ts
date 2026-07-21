/**
 * Opaque pagination cursor for the events timeline: the id of the last row
 * a page ended on. The repository re-derives that row's exact
 * `(created_at, id)` position server-side (see `repository.ts`'s
 * `listByDomain`) rather than the cursor carrying a `created_at` value
 * itself — the `postgres` driver round-trips `timestamptz` through a JS
 * `Date`, which only has millisecond resolution, while two events
 * published back-to-back (e.g. `domain.check_passed` immediately followed
 * by `domain.verified`) routinely land in the same millisecond. A cursor
 * built from a JS-truncated timestamp can then mis-place the boundary row
 * (comparing a rounded value against Postgres's full microsecond-precision
 * column) and either repeat or skip it across pages. Carrying only the id
 * and letting Postgres look up its own stored value avoids that entirely.
 */
export interface EventsCursor {
  id: string
}

export function encodeEventsCursor(cursor: EventsCursor): string {
  return Buffer.from(JSON.stringify({ id: cursor.id })).toString('base64url')
}

/** Returns `undefined` for anything that isn't a validly-encoded cursor — the caller treats that as "start from the beginning" rather than a hard error, since a cursor is opaque to whoever holds it. */
export function decodeEventsCursor(value: string): EventsCursor | undefined {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf-8'),
    )

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('id' in decoded) ||
      typeof decoded.id !== 'string'
    ) {
      return undefined
    }

    return { id: decoded.id }
  } catch {
    return undefined
  }
}
