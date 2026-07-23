/**
 * The First-run walkthrough's sandbox domain — seeded to go from `pending`
 * to `verified` in about 45 seconds with no real DNS involved (see the
 * `.test` fixture resolver in `apps/api/src/infra/dns/sandbox.ts`). Shared
 * across every integration-path tab and the Agents & CLI prompt so the
 * whole walkthrough tells one consistent story.
 */
export const SANDBOX_DOMAIN = 'pending-then-verified.test'
