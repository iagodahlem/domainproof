/**
 * Shared test doubles for this api's own shared/ ports (today, just
 * `Logger`) — mirrors `packages/core/src/testing/`'s pattern of one file
 * per test double plus a barrel, so a future shared port picks up the same
 * convention instead of another one-off in-test fake.
 */
export * from './fake-logger'
