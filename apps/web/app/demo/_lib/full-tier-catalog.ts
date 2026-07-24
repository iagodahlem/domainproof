/**
 * Titles of the five full-tier checks, mirrored from `_lib/checks/*.ts`'s
 * `title` fields — used only to label locked rows before verification, when
 * the backend hasn't returned any data for them yet. Never used as a
 * source of check results themselves.
 */
export const FULL_TIER_CHECK_TITLES = [
  'Full header breakdown',
  'Technology fingerprint',
  'Email posture',
  'Cookie & session security',
  'DNS security posture',
] as const
