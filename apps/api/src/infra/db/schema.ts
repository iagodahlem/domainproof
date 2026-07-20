import { DOMAIN_STATUSES } from '@domainproof/core'
import {
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
  },
  (table) => [
    unique('domains_project_domain_mode_unique').on(
      table.projectId,
      table.domain,
      table.mode,
    ),
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
 * The user-facing event timeline for a domain (what we queried, what we
 * detected, what changed). Append-only: rows are never updated or deleted
 * once written, only ever inserted.
 */
export const verificationEvents = pgTable('verification_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  domainId: uuid('domain_id')
    .notNull()
    .references(() => domains.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  detail: jsonb('detail').notNull(),
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
