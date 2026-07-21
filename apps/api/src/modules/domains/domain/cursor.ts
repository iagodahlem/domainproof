/**
 * Opaque pagination cursor for the dashboard's project domains list: the id
 * of the last row a page ended on. Same shape and rationale as the events
 * module's `EventsCursor` (see `modules/events/domain/cursor.ts`) — the
 * repository re-derives the cursor row's exact `(created_at, id)` position
 * server-side rather than round-tripping a `created_at` value through the
 * cursor itself, which would lose the precision needed to place the
 * boundary row exactly once two domains are claimed in the same
 * millisecond. Ordering is newest-first here (unlike the events timeline's
 * oldest-first), matching what a dashboard domains table wants: the most
 * recently claimed domain at the top.
 */
export interface DomainsCursor {
  id: string
}

export function encodeDomainsCursor(cursor: DomainsCursor): string {
  return Buffer.from(JSON.stringify({ id: cursor.id })).toString('base64url')
}

/** Returns `undefined` for anything that isn't a validly-encoded cursor — the caller treats that as "start from the beginning" rather than a hard error, since a cursor is opaque to whoever holds it. */
export function decodeDomainsCursor(value: string): DomainsCursor | undefined {
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
