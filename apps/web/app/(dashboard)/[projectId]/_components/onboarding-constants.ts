/**
 * The First-run walkthrough's sandbox domain — seeded to go from `pending`
 * to `verified` in about 15 seconds with no real DNS involved (see the
 * `.test` fixture resolver in `apps/api/src/infra/dns/sandbox.ts`, and this
 * directory's own `use-bounded-poll.ts`, which drives the active auto-check
 * that catches it that fast). Shared across every integration-path tab and
 * the Agents & CLI prompt so the whole walkthrough tells one consistent
 * story.
 */
export const SANDBOX_DOMAIN = 'pending-then-verified.test'

/**
 * One shared max-width for every code/record/copy surface in the
 * walkthrough (the request code card, the TXT record card, the hosted-link
 * copy field, every components/agents-path code block, the "watch it land"
 * domain card) — `ch`-based so it scales with the surface's own monospace
 * type instead of a fixed pixel value, and wide enough that none of this
 * walkthrough's actual snippets wrap a line that wasn't already broken by
 * its author. Keeps these surfaces from stretching full-row on wide
 * screens the way plain block-level elements otherwise would.
 */
export const WALKTHROUGH_SURFACE_MAX_WIDTH = 'max-w-[70ch]'
