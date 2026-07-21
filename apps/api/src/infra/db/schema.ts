import { isNotNull } from 'drizzle-orm'
import { DOMAIN_STATUSES } from '@domainproof/core'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Every domain claim, API key, and webhook endpoint carries a `mode` of
 * either "test" or "live". Test/live data separation happens at this column
 * (and at the key that authenticates a request), not by giving a project two
 * separate rows — a project is a single row that owns both modes.
 */
export const modeEnum = pgEnum('mode', ['test', 'live'])

/**
 * Domain verification status, derived from the core package's state machine
 * so the database can never drift from the statuses the app code actually
 * produces. If a status is added or renamed in `@domainproof/core`, this
 * enum (and the migration generated from it) must be updated in lockstep.
 */
export const domainStatusEnum = pgEnum(
  'domain_status',
  DOMAIN_STATUSES as unknown as [string, ...string[]],
)

export const challengeMethodEnum = pgEnum('challenge_method', [
  'dns_txt',
  'http_file',
])

export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'pending',
  'succeeded',
  'failed',
])

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  /**
   * Captured at account bootstrap (see `modules/accounts/service.ts`'s
   * `ensureAccount`) from the verified Clerk session claims, or via a
   * resolver port when the claims don't carry one. Nullable: neither
   * source is guaranteed to produce an address, and a missing email just
   * means the welcome/notification emails are skipped for that account
   * rather than blocking bootstrap.
   */
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * A project belongs to one account. Mode-agnostic by design: test/live
 * separation happens at the key + domain level (see `modeEnum`), not by
 * creating a second project. A project's dashboard shows both modes.
 */
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /**
   * The project's brand slug, used to namespace DNS verification record
   * names and values (`_<slug>-challenge.<domain>`, `<slug>-verify=<token>`
   * — see `@domainproof/core`'s `record.ts`). Derived from the project name
   * via `modules/projects/domain/brand.ts`'s `deriveProjectSlug` at
   * creation time; no app code ever leaves this unset, but the column
   * itself carries no uniqueness constraint — two projects can share a
   * slug (e.g. both falling back to the same default).
   */
  slug: text('slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * API keys are shown once at creation time. Only a SHA-256 hash of the
 * secret is ever persisted; `last4` is kept so the dashboard can render a
 * recognizable identifier ("dp_live_...ab12") without holding the secret.
 */
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  mode: modeEnum('mode').notNull(),
  keyId: text('key_id').notNull().unique(),
  secretHash: text('secret_hash').notNull(),
  last4: text('last4').notNull(),
  name: text('name'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * `domain` is the normalized registrable domain (e.g. via tldts). The
 * UNIQUE(project_id, domain, mode) constraint enforces one claim per
 * project — it deliberately does NOT span projects, because different
 * accounts/projects may legitimately claim the same domain at the same
 * time (e.g. an agency and its client both verifying ownership).
 */
export const domains = pgTable(
  'domains',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    mode: modeEnum('mode').notNull(),
    status: domainStatusEnum('status').notNull().default('not_started'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /**
     * When the background re-check worker (`workers/`) should next
     * run this domain's check — a backoff ladder while `pending`, a slow
     * 24h cadence while `verified`, a tighter 15m cadence while
     * `temporarily_failed` (its 72h grace window is `grace_expires_at`
     * below), and `null` once `failed` (no more automatic checks). See
     * `modules/domains/domain/recheck-schedule.ts`.
     */
    nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
    /** The last time any check (manual or scheduled) ran against this domain. `null` until the first one. */
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    /**
     * Consecutive checks that found the domain still `pending` — the rung
     * of the pending backoff ladder it currently sits at. Reset to 0
     * whenever the domain isn't (or stops being) `pending`.
     */
    checkAttempts: integer('check_attempts').notNull().default(0),
    /**
     * Set when a `verified` domain loses its record and enters the 72h
     * grace window (`temporarily_failed`); cleared on recovery or expiry.
     * The scheduled worker expires a domain past this timestamp via core's
     * `grace_expired` event — never `verifyDomain` itself, see its doc
     * comment.
     */
    graceExpiresAt: timestamp('grace_expires_at', { withTimezone: true }),
    /**
     * The unguessable bearer credential for the Frontend API plane
     * (`apis/frontend/`) — read + rate-limited re-check access to exactly
     * this one domain claim, nothing else. Generated once at claim time via
     * core's `generateToken()` (the same 128-bit CSPRNG entropy standard as
     * an API key secret) and embedded directly in `hosted_verification_url`.
     * Deliberately a column of its own rather than reusing `id`: `id` is an
     * internal identifier that already appears in event payloads, webhook
     * deliveries, and dashboard URLs, none of which are secret — conflating
     * it with a bearer credential would make every one of those surfaces a
     * capability leak. Stored in plaintext (like `challenges.token` and
     * `webhook_endpoints.signing_secret`): it must be read back verbatim to
     * serve the hosted verification page, so hashing it isn't an option.
     */
    frontendToken: text('frontend_token').notNull().unique(),
    /**
     * The outcome of the most recent `verifyDomain` attempt (`found`,
     * `wrong_value`, `not_found`, `unreachable`, or `expired`), plus the
     * expected/detected material behind it — mirrors
     * `modules/domains/service.ts`'s `VerifyDomainCheck` shape (minus
     * `checkedAt`, which is `last_checked_at` above). `null` until the first
     * check ever runs, same as `last_checked_at`. Exists so a caller that
     * only reads a claim's current state (the Frontend API's hosted
     * verification page) can render "what the last check found" without
     * re-running a DNS check just to answer that — the timeline in `events`
     * only carries a bare `outcome` string for `domain.check_failed`, not
     * this expected-vs-detected detail. Left untouched by
     * `expireOverdueGraceWindows`, which transitions a domain to `failed` on
     * a timer without ever running a check (see its doc comment) — the
     * grace-window expiry doesn't invalidate what the last real check found.
     */
    lastCheckResult: jsonb('last_check_result').$type<{
      outcome: string
      expectedValue: string
      detectedValues: string[]
    } | null>(),
  },
  (table) => [
    unique('domains_project_domain_mode_unique').on(
      table.projectId,
      table.domain,
      table.mode,
    ),
    /**
     * Serves `findDueForRecheck`'s `WHERE next_check_at IS NOT NULL AND
     * next_check_at <= now() ORDER BY next_check_at LIMIT n` — partial on
     * `IS NOT NULL` because `failed` domains (and any other terminal state)
     * always carry a `null` here and would otherwise sit in the index
     * forever without ever matching the worker's query.
     */
    index('domains_next_check_at_idx')
      .on(table.nextCheckAt)
      .where(isNotNull(table.nextCheckAt)),
  ],
)

/**
 * Regenerating a challenge issues a new row and marks the previous one
 * superseded rather than deleting or mutating it, keeping a full history of
 * every token that was ever live for a domain.
 */
export const challenges = pgTable('challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  domainId: uuid('domain_id')
    .notNull()
    .references(() => domains.id, { onDelete: 'cascade' }),
  method: challengeMethodEnum('method').notNull(),
  token: text('token').notNull(),
  recordHost: text('record_host').notNull(),
  recordValue: text('record_value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * The generic, append-only event log every published `DomainEvent` (see
 * `shared/events.ts`) lands in, via the events module's persistence
 * subscriber — the one guaranteed write every event gets, regardless of
 * which other subscribers (email, ...) also react to it. Replaces the
 * narrower `verification_events` table: `type` is a namespaced string
 * ('domain.verified', 'account.created', ...) spanning every module, not
 * just domain verification attempts.
 *
 * `domainId` and `mode` are both nullable because not every event is
 * domain- or mode-scoped — `account.created` has neither. `payload` is the
 * event's full typed payload, stored as-is for replay/inspection.
 */
export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(),
  domainId: uuid('domain_id').references(() => domains.id, {
    onDelete: 'cascade',
  }),
  mode: modeEnum('mode'),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * `signing_secret` is stored in plaintext. It must be shown to the user
 * (unlike an API key secret) and used to compute the HMAC signature on
 * every webhook delivery, so hashing it isn't an option. Storing it
 * encrypted-at-rest via a KMS envelope (rather than plaintext) is the
 * production-grade approach and is out of scope for this change.
 */
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  signingSecret: text('signing_secret').notNull(),
  mode: modeEnum('mode').notNull(),
  /**
   * The subset of `DomainEventMap`'s domain-scoped event types (see
   * `shared/events.ts`; `account.created` is excluded — it isn't
   * project-scoped, so no webhook endpoint could ever match it) this
   * endpoint receives deliveries for. Always non-empty — enforced at the
   * service layer, not by a db constraint.
   */
  eventTypes: text('event_types').array().notNull(),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  endpointId: uuid('endpoint_id')
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  attempt: integer('attempt').notNull().default(1),
  status: webhookDeliveryStatusEnum('status').notNull().default('pending'),
  responseStatus: integer('response_status'),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
