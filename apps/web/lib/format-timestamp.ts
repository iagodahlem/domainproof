/**
 * "Jul 23, 8:14 AM" — shared absolute-timestamp format for log/table rows
 * (events, webhook deliveries) that need to scan across days rather than
 * track a single "how long ago" (see `format-relative-time.ts` for that).
 * Omits the year (these logs don't run that long) and seconds (more
 * precision than a table row needs to be scannable).
 */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
