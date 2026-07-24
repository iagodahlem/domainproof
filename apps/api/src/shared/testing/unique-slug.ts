import { randomUUID } from 'node:crypto'

/**
 * A real, globally unique slug (`projects.slug` carries a real unique
 * constraint shared with every other test file's rows) — a random UUID
 * fragment appended to `base` avoids collisions with this same file's other
 * tests, or another test file's own fixed literal, once run concurrently
 * against a real db.
 */
export function uniqueSlug(base: string): string {
  return `${base}-${randomUUID().slice(0, 8)}`
}
