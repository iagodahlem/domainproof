/**
 * Opaque pagination cursor for a webhook endpoint's delivery log: the id of
 * the last row a page ended on. Same shape and same reasoning as
 * `modules/events/domain/cursor.ts`'s `EventsCursor` — the repository
 * re-derives the cursor row's exact `(created_at, id)` position server-side
 * rather than round-tripping a `created_at` value through the JS driver's
 * millisecond-truncated `Date`, which can mis-place the boundary row when
 * two deliveries land in the same millisecond (e.g. an event fired to two
 * subscribed endpoints at once).
 */
export interface DeliveriesCursor {
  id: string
}

export function encodeDeliveriesCursor(cursor: DeliveriesCursor): string {
  return Buffer.from(JSON.stringify({ id: cursor.id })).toString('base64url')
}

/** Returns `undefined` for anything that isn't a validly-encoded cursor — the caller treats that as "start from the beginning" rather than a hard error, since a cursor is opaque to whoever holds it. */
export function decodeDeliveriesCursor(
  value: string,
): DeliveriesCursor | undefined {
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
