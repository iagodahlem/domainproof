const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * "2 min ago" / "in ~3 min" style relative time for the handful of domain
 * timestamps this route renders (table's "Last checked", detail's status
 * meta) — small and local rather than pulling in a date library for that.
 */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const diffMs = new Date(iso).getTime() - now.getTime()
  const absMs = Math.abs(diffMs)

  if (absMs < 45_000) return 'just now'

  const [amount, unit] =
    absMs < HOUR_MS
      ? [Math.round(absMs / MINUTE_MS), 'min']
      : absMs < DAY_MS
        ? [Math.round(absMs / HOUR_MS), 'hr']
        : [Math.round(absMs / DAY_MS), 'd']

  return diffMs > 0 ? `in ~${amount} ${unit}` : `${amount} ${unit} ago`
}
