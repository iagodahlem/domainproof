const MAX_SLUG_LENGTH = 32
const FALLBACK_SLUG_PREVIEW = 'app'

/**
 * Live preview of the brand slug a project name will derive to — mirrors
 * `apps/api`'s `deriveProjectSlug` transform (lowercase, fold whitespace/
 * underscores to hyphens, strip anything else, collapse/trim hyphens) so
 * the hint shown while typing matches what the API actually assigns. Not
 * authoritative: it skips the reserved-word check, since this is cosmetic
 * preview text, not the value submitted to the API.
 */
export function slugPreview(name: string): string {
  const candidate = name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')

  return candidate || FALLBACK_SLUG_PREVIEW
}
