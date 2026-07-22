/**
 * Locked-screen card width matching the board's .lockscreen .card spec, no
 * spacing-scale equivalent — shared by `CreateProjectFlow`'s card and the
 * `/new` page's own back-link wrapper so the two line up. Kept in a plain
 * module rather than re-exported from `create-project-flow.tsx`: that file
 * is `'use client'`, and a Server Component reading a plain value export
 * across that boundary gets a client reference placeholder instead of the
 * string, silently dropping the class.
 */
export const CREATE_PROJECT_CARD_WIDTH = 'max-w-[440px]'
