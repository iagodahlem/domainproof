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
import type {
  ProviderForDomain,
  ResolverForChallenge,
} from '@modules/domains/ports'
import {
  createCloudflareOAuthService,
  type CloudflareOAuthService,
} from '@modules/cloudflare/service'
import type { CloudflareClient } from '@modules/cloudflare/ports'
import { createComponentSessionsRepository } from '@modules/component-sessions/repository'
import {
  createComponentSessionsService,
  type ComponentSessionsService,
} from '@modules/component-sessions/service'
import { createEventsRepository } from '@modules/events/repository'
import {
  createEventsService,
  type EventsService,
} from '@modules/events/service'
import { createNotificationsService } from '@modules/notifications/service'
import type { EmailSender } from '@modules/notifications/ports'
import { createWebhooksRepository } from '@modules/webhooks/repository'
import {
  createWebhooksService,
  type WebhooksService,
} from '@modules/webhooks/service'
import { WEBHOOK_EVENT_TYPES } from '@modules/webhooks/domain/event-types'
import type { WebhookSender } from '@modules/webhooks/ports'
import { createDashboardRouter } from '@apis/dashboard/router'
import { createV1Router } from '@apis/v1/router'
import { createFrontendRouter } from '@apis/frontend/router'
import { createClerkSessionVerifier } from '@infra/auth/clerk'
import { createDb, type Database } from '@infra/db/client'
import {
  createNodeDnsResolver,
  createNodeNsResolver,
} from '@infra/dns/node-dns'
import { createSandboxResolver } from '@infra/dns/sandbox'
import { createInProcessEventBus } from '@infra/events/in-process-bus'
import { createResendEmailSender } from '@infra/email/resend'
import { createChildLogger, logger } from '@infra/logging/logger'
import { createNodeFetchWebhookSender } from '@infra/http/webhook-sender'
import { createCloudflareOAuthClient } from '@infra/cloudflare/oauth-client'
import { detectProvider, isSandboxDomain } from '@domainproof/core'
import { DOMAIN_EVENT_TYPES } from '@shared/events'
import { env } from './env'
import { apiError } from '@shared/http-errors'
import { createHostRestrictionMiddleware } from '@shared/middlewares/host-restriction'
import { createRequestLoggerMiddleware } from '@shared/middlewares/request-logger'
import { createOpenApiRouteHandler } from './openapi'

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

/**
 * Builds the Frontend API's provider-detection port: `.test` sandbox
 * domains short-circuit to `'unknown'` (they have no real DNS to inspect —
 * same reasoning as `createResolverForChallenge`'s sandbox branch), every
 * other domain goes through a real NS lookup plus core's `detectProvider`.
 * This is the one place `isSandboxDomain`/`createNodeNsResolver`/
 * `detectProvider` get composed together — `modules/domains` only ever
 * sees the `ProviderForDomain` port (see `modules/domains/ports.ts`).
 */
function createProviderForDomain(): ProviderForDomain {
  const nsResolver = createNodeNsResolver()

  return async (domain) => {
    if (isSandboxDomain(domain)) {
      return 'unknown'
    }

    const resolution = await nsResolver.resolveNs(domain)
    return resolution.ok ? detectProvider(resolution.nameservers) : 'unknown'
  }
}

/**
 * The Cloudflare one-click DNS setup flow's fixed redirect URI — must
 * exactly match what's registered on the Cloudflare OAuth client (see
 * README's Cloudflare setup section). Hardcoded rather than derived from
 * `env.FRONTEND_API_HOST` (unset outside production, same as
 * `VERIFICATION_BASE_URL` in `apis/v1/routes/domains.ts`/`apis/dashboard/routes/domains.ts`)
 * — this is a display/redirect-only value, never dereferenced by this
 * process itself, so there's no local/staging variant to wire up here.
 */
const CLOUDFLARE_OAUTH_REDIRECT_URI =
  'https://frontend.api.domainproof.dev/frontend/cloudflare/callback'

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
   * Injected for tests; defaults to `env.FRONTEND_API_HOST`. See
   * `shared/middlewares/host-restriction.ts`.
   */
  frontendApiHost?: string
  /**
   * Injected for tests; defaults to `env.WEB_ORIGIN`. See
   * `apis/dashboard/router.ts`'s CORS policy.
   */
  webOrigin?: string
  /**
   * Injected for tests (a fake — never hit the real Resend network from a
   * test); defaults to a Resend-backed sender built from
   * `env.RESEND_API_KEY` / `env.EMAIL_FROM`, or `undefined` if
   * `RESEND_API_KEY` isn't set — in which case the email notification
   * subscribers are never registered at all (see `createApp` below), a
   * clean log-and-skip rather than a crash.
   */
  emailSender?: EmailSender
  /**
   * Injected for tests (a fake — never make real network requests to a
   * receiver from a test); defaults to a fetch-backed sender. Unlike
   * `emailSender`, this is always registered — a webhook endpoint can't be
   * created before this is wired up, so there's no "unconfigured vendor"
   * case to skip.
   */
  webhookSender?: WebhookSender
  /**
   * Injected for tests (a fake HTTP-port implementing `CloudflareClient` —
   * never make real requests to Cloudflare from a test); defaults to a
   * fetch-backed adapter built from the resolved client id/secret below.
   * Only ever constructed/used when the Cloudflare OAuth flow is
   * configured (see `cloudflareOAuthClientId`/`cloudflareOAuthClientSecret`).
   */
  cloudflareClient?: CloudflareClient
  /**
   * Injected for tests; defaults to `env.CLOUDFLARE_OAUTH_CLIENT_ID` /
   * `env.CLOUDFLARE_OAUTH_CLIENT_SECRET`. Both unset (the default) means
   * the Cloudflare one-click routes respond `404 not_configured` instead
   * of the app refusing to boot — same pattern as `sessionVerifier`/
   * `emailSender` above.
   */
  cloudflareOAuthClientId?: string
  cloudflareOAuthClientSecret?: string
}

export interface AppServices {
  db: Database
  accountsService: AccountsService
  projectsService: ProjectsService
  keysService: KeysService
  keysRepository: KeysRepository
  domainsService: DomainsService
  eventsService: EventsService
  webhooksService: WebhooksService
  componentSessionsService: ComponentSessionsService
  sessionVerifier: SessionVerifier | undefined
  providerForDomain: ProviderForDomain
  cloudflareOAuthService: CloudflareOAuthService | undefined
}

/**
 * The composition root's service-wiring half: every repository, service,
 * and event subscriber gets built and wired here, exactly once. Split out
 * from `createApp` (below) so `src/seed.ts` — a second entrypoint that
 * needs the same real services, not a duplicate of their construction —
 * and `index.ts` — which needs `domainsService` for the background recheck
 * scheduler (`workers/`), not just the HTTP app — can both reuse this
 * instead of hand-wiring their own modules, which would both violate "only
 * the composition root imports from `modules/`" and risk drifting from how
 * `createApp` actually wires things (e.g. forgetting the `eventBus` a
 * service depends on). Nothing outside this file constructs a `Database`,
 * a repository, or a `SessionVerifier` — modules and planes only ever
 * receive them as arguments.
 */
export function createServices(deps: AppDependencies = {}): AppServices {
  const db = deps.db ?? createDb(env.DATABASE_URL)

  // The event bus: every domain status transition and account bootstrap
  // publishes here, and everything downstream (the timeline, email) is a
  // subscriber — see shared/events.ts. Persistence is registered first,
  // for every event type, before any other subscriber (notifications,
  // below) — so the events table is a complete record of everything
  // published, regardless of what else reacts to it.
  const eventBus = createInProcessEventBus(
    createChildLogger({ module: 'events' }),
  )

  const eventsRepository = createEventsRepository(db)
  const eventsService = createEventsService(eventsRepository)
  for (const type of DOMAIN_EVENT_TYPES) {
    eventBus.subscribe(type, (payload) => eventsService.record(type, payload))
  }

  const accountsRepository = createAccountsRepository(db)
  const accountsService = createAccountsService(
    accountsRepository,
    eventBus,
    undefined,
    createChildLogger({ module: 'accounts' }),
  )

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

  const componentSessionsRepository = createComponentSessionsRepository(db)
  const componentSessionsService = createComponentSessionsService(
    componentSessionsRepository,
    domainsService,
    deps.now ?? (() => new Date()),
  )

  // Only registered when a sender is actually configured — same pattern
  // as `sessionVerifier` below (an unconfigured vendor integration is a
  // no-op, not a boot failure). Unset `RESEND_API_KEY` in dev/test means
  // these subscribers simply never run, rather than every send needing
  // its own "is this configured" guard.
  const emailSender =
    deps.emailSender ??
    (env.RESEND_API_KEY
      ? createResendEmailSender(
          { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
          createChildLogger({ module: 'email' }),
        )
      : undefined)

  if (emailSender) {
    const notifications = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: accountsService.getEmailForProject,
      logger: createChildLogger({ module: 'notifications' }),
    })
    eventBus.subscribe('account.created', notifications.onAccountCreated)
    eventBus.subscribe('domain.verified', notifications.onDomainVerified)
    eventBus.subscribe(
      'domain.temporarily_failed',
      notifications.onDomainTemporarilyFailed,
    )
    eventBus.subscribe('domain.failed', notifications.onDomainFailed)
  } else {
    logger.info(
      {},
      'RESEND_API_KEY not configured — email notifications are disabled',
    )
  }

  const webhooksRepository = createWebhooksRepository(db)
  const webhooksService = createWebhooksService(
    webhooksRepository,
    deps.webhookSender ?? createNodeFetchWebhookSender(),
    { now: deps.now, maxAttempts: env.WEBHOOK_MAX_ATTEMPTS },
    createChildLogger({ module: 'webhooks' }),
  )
  // Registered for every project-scoped event type (everything except
  // `account.created`, which no endpoint can subscribe to — see
  // `WEBHOOK_EVENT_TYPES`'s doc comment). `dispatchEvent` only creates the
  // delivery rows synchronously; actual HTTP delivery runs in the
  // background, so this never slows down the request that published the
  // triggering event — see `modules/webhooks/service.ts`'s doc comment.
  for (const type of WEBHOOK_EVENT_TYPES) {
    eventBus.subscribe(type, async (payload) => {
      await webhooksService.dispatchEvent(type, payload)
    })
  }

  const sessionVerifier =
    deps.sessionVerifier ??
    (env.CLERK_JWKS_URL && env.CLERK_ISSUER
      ? createClerkSessionVerifier({
          jwksUrl: env.CLERK_JWKS_URL,
          issuer: env.CLERK_ISSUER,
        })
      : undefined)

  const providerForDomain = createProviderForDomain()

  // Only registered when both credentials are configured — same
  // unconfigured-vendor-is-a-clean-no-op pattern as `sessionVerifier`/
  // `emailSender` above. `deps.cloudflareClient` lets tests exercise the
  // real service/state-signing/event-publishing logic against a fake HTTP
  // port instead of real Cloudflare requests.
  const cloudflareOAuthClientId =
    deps.cloudflareOAuthClientId ?? env.CLOUDFLARE_OAUTH_CLIENT_ID
  const cloudflareOAuthClientSecret =
    deps.cloudflareOAuthClientSecret ?? env.CLOUDFLARE_OAUTH_CLIENT_SECRET

  const cloudflareOAuthService =
    cloudflareOAuthClientId && cloudflareOAuthClientSecret
      ? createCloudflareOAuthService(
          {
            clientId: cloudflareOAuthClientId,
            clientSecret: cloudflareOAuthClientSecret,
            redirectUri: CLOUDFLARE_OAUTH_REDIRECT_URI,
          },
          deps.cloudflareClient ??
            createCloudflareOAuthClient({
              clientId: cloudflareOAuthClientId,
              clientSecret: cloudflareOAuthClientSecret,
              redirectUri: CLOUDFLARE_OAUTH_REDIRECT_URI,
            }),
          domainsService,
          eventBus,
          deps.now ?? (() => new Date()),
        )
      : undefined

  return {
    db,
    accountsService,
    projectsService,
    keysService,
    keysRepository,
    domainsService,
    eventsService,
    webhooksService,
    componentSessionsService,
    sessionVerifier,
    providerForDomain,
    cloudflareOAuthService,
  }
}

/**
 * The composition root's HTTP half: builds the services (see
 * {@link createServices}) and mounts them onto the plane routers under
 * `apis/`, plus the app-wide middleware and error handling.
 *
 * Takes an optional pre-built `services` — `index.ts` calls
 * {@link createServices} once (to get `domainsService` for the background
 * recheck scheduler in `workers/`, which isn't an HTTP route) and passes
 * the result here so this doesn't wire a second, independent copy of
 * every service (a second event bus, a second webhooks repository, ...).
 * Every other caller (tests) omits it and gets a fresh set built from
 * `deps`, same as before.
 */
export function createApp(
  deps: AppDependencies = {},
  services: AppServices = createServices(deps),
) {
  const app = new Hono()
  const {
    keysService,
    keysRepository,
    projectsService,
    domainsService,
    eventsService,
    webhooksService,
    componentSessionsService,
    sessionVerifier,
    providerForDomain,
    cloudflareOAuthService,
  } = services

  // Logs every request, on both planes, before anything else runs — see
  // shared/middlewares/request-logger.ts.
  app.use(
    '*',
    createRequestLoggerMiddleware({
      logger: createChildLogger({ module: 'http' }),
    }),
  )

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
      frontendApiHost: deps.frontendApiHost ?? env.FRONTEND_API_HOST,
    }),
  )

  app.get('/health', (c) => {
    return c.json({ status: 'ok', version: pkg.version })
  })

  // Built from the `app` reference before every plane below is mounted, but
  // that's fine: `openAPIRouteHandler` only walks `app.routes` (and caches
  // the result) the first time this endpoint is actually hit, by which
  // point every route below has been registered. Unauthenticated and
  // outside every plane's path prefix on purpose — the SDK, docs site, and
  // MCP server this spec feeds all need to fetch it without an api key, the
  // same reason it's excluded from the v1 plane's own api-key middleware
  // (see `openapi.ts`'s doc comment for what it covers/excludes).
  app.get('/v1/openapi.json', createOpenApiRouteHandler(app))

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
      webhooksService,
      sessionVerifier,
      webOrigin: deps.webOrigin ?? env.WEB_ORIGIN,
    }),
  )
  app.route(
    '/v1',
    createV1Router({
      keysRepository,
      domainsService,
      eventsService,
      componentSessionsService,
      logger: createChildLogger({ module: 'v1.api-key' }),
    }),
  )
  app.route(
    '/frontend',
    createFrontendRouter({
      domainsService,
      eventsService,
      projectsService,
      componentSessionsService,
      providerForDomain,
      cloudflareOAuthService,
    }),
  )

  app.notFound((c) => {
    return c.json(apiError('not_found', 'Route not found'), 404)
  })

  app.onError((err, c) => {
    logger.error({ err }, 'Unhandled error')
    return c.json(apiError('internal_error', 'Internal server error'), 500)
  })

  return app
}
