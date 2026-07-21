import { Hono } from 'hono'
import type { KeysRepository } from '@modules/keys/repository'
import type { DomainsService } from '@modules/domains/service'
import type { EventsService } from '@modules/events/service'
import type { Logger } from '@shared/logger'
import { createRateLimitMiddleware } from '@shared/middlewares/rate-limit'
import {
  createApiKeyAuthMiddleware,
  type ApiKeyAuthVariables,
} from './middlewares/api-key'
import { createDomainsRoutes } from './routes/domains'

export interface V1RouterDeps {
  keysRepository: KeysRepository
  domainsService: DomainsService
  eventsService: EventsService
  /** Threaded into `createApiKeyAuthMiddleware` — the composition root (`app.ts`) always wires a real child logger; tests use `createFakeLogger` from `@shared/testing/fake-logger`. */
  logger: Logger
}

/**
 * The public product API root: authenticated with a project API key
 * (`dp_test_.../dp_live_...`), rate limited per key, versioned because
 * it's a contract external integrations depend on (see ARCHITECTURE.md's
 * Route planes). Auth and rate limiting are applied once here, for the
 * whole plane.
 *
 * `/domains` (domain claiming and its branded verification records) is
 * the first product route on this plane.
 */
export function createV1Router(deps: V1RouterDeps) {
  const router = new Hono<{ Variables: ApiKeyAuthVariables }>()

  router.use(
    '*',
    createApiKeyAuthMiddleware(deps.keysRepository, deps.logger),
    createRateLimitMiddleware(),
  )

  router.route(
    '/domains',
    createDomainsRoutes(deps.domainsService, deps.eventsService),
  )

  return router
}
