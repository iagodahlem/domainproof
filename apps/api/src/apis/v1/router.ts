import { Hono } from 'hono'
import type { KeysRepository } from '@modules/keys/repository'
import { createRateLimitMiddleware } from '@shared/middlewares/rate-limit'
import {
  createApiKeyAuthMiddleware,
  type ApiKeyAuthVariables,
} from './middlewares/api-key'

export interface V1RouterDeps {
  keysRepository: KeysRepository
}

/**
 * The public product API root: authenticated with a project API key
 * (`dp_test_.../dp_live_...`), rate limited per key, versioned because
 * it's a contract external integrations depend on (see ARCHITECTURE.md's
 * Route planes). Auth and rate limiting are applied once here, for the
 * whole plane.
 *
 * No routes yet — domain verification (creating a domain, checking its
 * status, triggering a recheck) lands here next.
 */
export function createV1Router(deps: V1RouterDeps) {
  const router = new Hono<{ Variables: ApiKeyAuthVariables }>()

  router.use(
    '*',
    createApiKeyAuthMiddleware(deps.keysRepository),
    createRateLimitMiddleware(),
  )

  return router
}
