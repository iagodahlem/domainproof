/**
 * Shared test support for this api's own test suite — test doubles for
 * shared/ ports (today, just `Logger`) and cross-cutting test-data helpers
 * like `uniqueSlug` — mirrors `packages/core/src/testing/`'s pattern of one
 * file per helper plus a barrel, so a future shared port or randomizer
 * picks up the same convention instead of another one-off in-test helper.
 */
export * from './fake-logger'
export * from './unique-slug'
