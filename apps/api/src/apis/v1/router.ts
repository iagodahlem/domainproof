import { Hono } from 'hono'
import type { KeysRepository } from '@modules/keys/repository'
import type { DomainsService } from '@modules/domains/service'
import { createRateLimitMiddleware } from '@shared/middlewares/rate-limit'
import {
  createApiKeyAuthMiddleware,
  type ApiKeyAuthVariables,
} from './middlewares/api-key'
import { createDomainsRoutes } from './routes/domains'

export interface V1RouterDeps {
  keysRepository: KeysRepository
  domainsService: DomainsService
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
    createApiKeyAuthMiddleware(deps.keysRepository),
    createRateLimitMiddleware(),
  )

  router.route('/domains', createDomainsRoutes(deps.domainsService))

  return router
}
