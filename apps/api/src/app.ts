import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import type { SessionVerifier } from '@modules/accounts/ports'
import { createAccountsRepository } from '@modules/accounts/repository'
import {
  createAccountsService,
  type AccountsService,
} from '@modules/accounts/service'
import { createProjectsRepository } from '@modules/projects/repository'
import {
  createProjectsService,
  type ProjectsService,
} from '@modules/projects/service'
import { createKeysRepository } from '@modules/keys/repository'
import { createKeysService, type KeysService } from '@modules/keys/service'
import type { KeysRepository } from '@modules/keys/repository'
import { createDomainsRepository } from '@modules/domains/repository'
import {
  createDomainsService,
  type DomainsService,
} from '@modules/domains/service'
import type { ResolverForChallenge } from '@modules/domains/ports'
import { createEventsRepository } from '@modules/events/repository'
import {
  createEventsService,
  type EventsService,
} from '@modules/events/service'
import { createNotificationsService } from '@modules/notifications/service'
import type { EmailSender } from '@modules/notifications/ports'
import { createDashboardRouter } from '@apis/dashboard/router'
import { createV1Router } from '@apis/v1/router'
import { createClerkSessionVerifier } from '@infra/auth/clerk'
import { createDb, type Database } from '@infra/db/client'
import { createNodeDnsResolver } from '@infra/dns/node-dns'
import { createSandboxResolver } from '@infra/dns/sandbox'
import { createInProcessEventBus } from '@infra/events/in-process-bus'
import { createResendEmailSender } from '@infra/email/resend'
import { isSandboxDomain } from '@domainproof/core'
import { DOMAIN_EVENT_TYPES } from '@shared/events'
import { env } from './env'
import { apiError } from '@shared/http-errors'
import { createHostRestrictionMiddleware } from '@shared/middlewares/host-restriction'
import { createRequestLoggerMiddleware } from '@shared/middlewares/request-logger'

/**
 * Builds the `verifyDomain` use case's resolver-selection port: `.test`
 * sandbox domains get a fresh in-memory `createSandboxResolver` built from
 * the challenge being checked; every other domain shares one
 * `createNodeDnsResolver` instance (it's stateless — a fresh client is
 * created per query internally, see `infra/dns/node-dns.ts`). This is the
 * one place `isSandboxDomain`/`createSandboxResolver`/`createNodeDnsResolver`
 * get imported — `modules/domains` only ever sees the `ResolverForChallenge`
 * port (see `modules/domains/ports.ts`), never these concrete adapters.
 */
function createResolverForChallenge(): ResolverForChallenge {
  const nodeDnsResolver = createNodeDnsResolver()

  return ({
    domain,
    recordHost,
    recordValue,
    brandSlug,
    challengeCreatedAt,
    now,
  }) => {
    if (isSandboxDomain(domain)) {
      return createSandboxResolver(
        { recordHost, recordValue, brandSlug, createdAt: challengeCreatedAt },
        now,
      )
    }
    return nodeDnsResolver
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))

interface PackageJson {
  version: string
}

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as PackageJson

export interface AppDependencies {
  /**
   * Injected by the entrypoint (which migrates it before boot) and by
   * tests; defaults to a client built from `env.DATABASE_URL`.
   */
  db?: Database
  /**
   * Injected for tests; defaults to a Clerk-backed verifier built from
   * `env.CLERK_JWKS_URL` / `env.CLERK_ISSUER`, or `undefined` (dashboard
   * routes 500 with `auth_not_configured`) if those aren't set.
   */
  sessionVerifier?: SessionVerifier
  /**
   * Clock injected into `domainsService` for deterministic tests (e.g.
   * driving a sandbox domain's simulated DNS propagation delay without
   * sleeping). Defaults to `() => new Date()`.
   */
  now?: () => Date
  /**
   * Injected for tests; defaults to `env.PUBLIC_API_HOST`. See
   * `shared/middlewares/host-restriction.ts`.
   */
  publicApiHost?: string
  /**
   * Injected for tests; defaults to `env.DASHBOARD_API_HOST`. See
   * `shared/middlewares/host-restriction.ts`.
   */
  dashboardApiHost?: string
  /**
   * Injected for tests (a fake — never hit the real Resend network from a
   * test); defaults to a Resend-backed sender built from
   * `env.RESEND_API_KEY` / `env.EMAIL_FROM`, or `undefined` if
   * `RESEND_API_KEY` isn't set — in which case the email notification
   * subscribers are never registered at all (see `createApp` below), a
   * clean log-and-skip rather than a crash.
   */
  emailSender?: EmailSender
}

export interface AppServices {
  db: Database
  accountsService: AccountsService
  projectsService: ProjectsService
  keysService: KeysService
  keysRepository: KeysRepository
  domainsService: DomainsService
  eventsService: EventsService
  sessionVerifier: SessionVerifier | undefined
}

/**
 * The composition root's service-wiring half: every repository, service,
 * and event subscriber gets built and wired here, exactly once. Split out
 * from `createApp` (below) so `src/seed.ts` — a second entrypoint that
 * needs the same real services, not a duplicate of their construction —
 * can reuse this instead of hand-wiring its own modules, which would both
 * violate "only the composition root imports from `modules/`" and risk
 * drifting from how `createApp` actually wires things (e.g. forgetting the
 * `eventBus` a service depends on). Nothing outside this file constructs a
 * `Database`, a repository, or a `SessionVerifier` — modules and planes
 * only ever receive them as arguments.
 */
export function createServices(deps: AppDependencies = {}): AppServices {
  const db = deps.db ?? createDb(env.DATABASE_URL)

  // The event bus: every domain status transition and account bootstrap
  // publishes here, and everything downstream (the timeline, email) is a
  // subscriber — see shared/events.ts. Persistence is registered first,
  // for every event type, before any other subscriber (notifications,
  // below) — so the events table is a complete record of everything
  // published, regardless of what else reacts to it.
  const eventBus = createInProcessEventBus()

  const eventsRepository = createEventsRepository(db)
  const eventsService = createEventsService(eventsRepository)
  for (const type of DOMAIN_EVENT_TYPES) {
    eventBus.subscribe(type, (payload) => eventsService.record(type, payload))
  }

  const accountsRepository = createAccountsRepository(db)
  const accountsService = createAccountsService(accountsRepository, eventBus)

  const keysRepository = createKeysRepository(db)
  const keysService = createKeysService(keysRepository)

  const projectsRepository = createProjectsRepository(db)
  const projectsService = createProjectsService(
    projectsRepository,
    accountsService,
    keysService,
  )

  const domainsRepository = createDomainsRepository(db)
  const domainsService = createDomainsService(
    domainsRepository,
    projectsService,
    createResolverForChallenge(),
    deps.now ?? (() => new Date()),
    eventBus,
  )

  // Only registered when a sender is actually configured — same pattern
  // as `sessionVerifier` below (an unconfigured vendor integration is a
  // no-op, not a boot failure). Unset `RESEND_API_KEY` in dev/test means
  // these subscribers simply never run, rather than every send needing
  // its own "is this configured" guard.
  const emailSender =
    deps.emailSender ??
    (env.RESEND_API_KEY
      ? createResendEmailSender({
          apiKey: env.RESEND_API_KEY,
          from: env.EMAIL_FROM,
        })
      : undefined)

  if (emailSender) {
    const notifications = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: accountsService.getEmailForProject,
    })
    eventBus.subscribe('account.created', notifications.onAccountCreated)
    eventBus.subscribe('domain.verified', notifications.onDomainVerified)
    eventBus.subscribe(
      'domain.temporarily_failed',
      notifications.onDomainTemporarilyFailed,
    )
    eventBus.subscribe('domain.failed', notifications.onDomainFailed)
  } else {
    console.log(
      'RESEND_API_KEY not configured — email notifications are disabled',
    )
  }

  const sessionVerifier =
    deps.sessionVerifier ??
    (env.CLERK_JWKS_URL && env.CLERK_ISSUER
      ? createClerkSessionVerifier({
          jwksUrl: env.CLERK_JWKS_URL,
          issuer: env.CLERK_ISSUER,
        })
      : undefined)

  return {
    db,
    accountsService,
    projectsService,
    keysService,
    keysRepository,
    domainsService,
    eventsService,
    sessionVerifier,
  }
}

/**
 * The composition root's HTTP half: builds the services (see
 * {@link createServices}) and mounts them onto the plane routers under
 * `apis/`, plus the app-wide middleware and error handling.
 */
export function createApp(deps: AppDependencies = {}) {
  const app = new Hono()
  const {
    keysService,
    keysRepository,
    projectsService,
    domainsService,
    eventsService,
    sessionVerifier,
  } = createServices(deps)

  // Logs every request, on both planes, before anything else runs — see
  // shared/middlewares/request-logger.ts.
  app.use('*', createRequestLoggerMiddleware())

  // Confines each configured plane hostname to its own path prefix — see
  // shared/middlewares/host-restriction.ts. Applied once, at the root,
  // ahead of every route below: unset in dev/tests/Railway's service
  // domain, so this is a no-op until the two production hostnames are
  // configured.
  app.use(
    '*',
    createHostRestrictionMiddleware({
      publicApiHost: deps.publicApiHost ?? env.PUBLIC_API_HOST,
      dashboardApiHost: deps.dashboardApiHost ?? env.DASHBOARD_API_HOST,
    }),
  )

  app.get('/health', (c) => {
    return c.json({ status: 'ok', version: pkg.version })
  })

  // /dashboard/* is the session-authenticated backend of the dashboard app
  // (unversioned — we control its only consumer). /v1/* is the public,
  // API-key-authenticated plane. See ARCHITECTURE.md's Route planes.
  app.route(
    '/dashboard',
    createDashboardRouter({
      keysService,
      projectsService,
      domainsService,
      eventsService,
      sessionVerifier,
    }),
  )
  app.route(
    '/v1',
    createV1Router({ keysRepository, domainsService, eventsService }),
  )

  app.notFound((c) => {
    return c.json(apiError('not_found', 'Route not found'), 404)
  })

  app.onError((err, c) => {
    console.error(err)
    return c.json(apiError('internal_error', 'Internal server error'), 500)
  })

  return app
}
