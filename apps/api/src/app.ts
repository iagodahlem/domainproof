import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import type { SessionVerifier } from '@modules/accounts/ports'
import { createAccountsRepository } from '@modules/accounts/repository'
import { createAccountsService } from '@modules/accounts/service'
import { createProjectsRepository } from '@modules/projects/repository'
import { createProjectsService } from '@modules/projects/service'
import { createKeysRepository } from '@modules/keys/repository'
import { createKeysService } from '@modules/keys/service'
import { createDomainsRepository } from '@modules/domains/repository'
import { createDomainsService } from '@modules/domains/service'
import { createDashboardRouter } from '@apis/dashboard/router'
import { createV1Router } from '@apis/v1/router'
import { createClerkSessionVerifier } from '@infra/auth/clerk'
import { createDb, type Database } from '@infra/db/client'
import { env } from './env'
import { apiError } from '@shared/http-errors'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface PackageJson {
  version: string
}

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as PackageJson

export interface AppDependencies {
  /** Injected for tests; defaults to a client built from `env.DATABASE_URL`. */
  db?: Database
  /**
   * Injected for tests; defaults to a Clerk-backed verifier built from
   * `env.CLERK_JWKS_URL` / `env.CLERK_ISSUER`, or `undefined` (dashboard
   * routes 500 with `auth_not_configured`) if those aren't set.
   */
  sessionVerifier?: SessionVerifier
}

/**
 * The composition root: every repository, service, and adapter gets built
 * and wired here, exactly once, then handed to the plane routers under
 * `apis/`. Nothing outside this file constructs a `Database`, a
 * repository, or a `SessionVerifier` — modules and planes only ever
 * receive them as arguments.
 */
export function createApp(deps: AppDependencies = {}) {
  const app = new Hono()
  const db = deps.db ?? createDb(env.DATABASE_URL)

  const accountsRepository = createAccountsRepository(db)
  const accountsService = createAccountsService(accountsRepository)

  const projectsRepository = createProjectsRepository(db)
  const projectsService = createProjectsService(
    projectsRepository,
    accountsService,
  )

  const keysRepository = createKeysRepository(db)
  const keysService = createKeysService(keysRepository)

  const domainsRepository = createDomainsRepository(db)
  const domainsService = createDomainsService(
    domainsRepository,
    projectsService,
  )

  const sessionVerifier =
    deps.sessionVerifier ??
    (env.CLERK_JWKS_URL && env.CLERK_ISSUER
      ? createClerkSessionVerifier({
          jwksUrl: env.CLERK_JWKS_URL,
          issuer: env.CLERK_ISSUER,
        })
      : undefined)

  app.get('/health', (c) => {
    return c.json({ status: 'ok', version: pkg.version })
  })

  // /dashboard/* is the session-authenticated backend of the dashboard app
  // (unversioned — we control its only consumer). /v1/* is the public,
  // API-key-authenticated plane. See ARCHITECTURE.md's Route planes.
  app.route(
    '/dashboard',
    createDashboardRouter({ keysService, projectsService, sessionVerifier }),
  )
  app.route('/v1', createV1Router({ keysRepository, domainsService }))

  app.notFound((c) => {
    return c.json(apiError('not_found', 'Route not found'), 404)
  })

  app.onError((err, c) => {
    console.error(err)
    return c.json(apiError('internal_error', 'Internal server error'), 500)
  })

  return app
}

export const app = createApp()
