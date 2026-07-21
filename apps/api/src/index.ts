import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createDb } from '@infra/db/client'
import { runMigrations } from '@infra/db/migrate'
import { createChildLogger, logger } from '@infra/logging/logger'
import { createRecheckScheduler } from '@workers/recheck-scheduler'
import { createApp, createServices } from './app'
import { env } from './env'

const __dirname = dirname(fileURLToPath(import.meta.url))

const db = createDb(env.DATABASE_URL)

try {
  // Runs to completion before the app is built below, so nothing ever
  // serves a request against a half-migrated schema. Resolved relative to
  // this file's own runtime location (same trick app.ts uses for
  // package.json) so it finds `drizzle/` both in dev (src/index.ts, one
  // level below apps/api) and from the tsup-bundled dist/index.js (one
  // level below the deployed image root).
  await runMigrations(db, join(__dirname, '..', 'drizzle'))
  logger.info({}, 'Migrations applied')
} catch (err) {
  logger.error({ err }, 'Migration failed, exiting')
  process.exit(1)
}

// Built once (see `app.ts`'s `createServices` doc comment) so the HTTP app
// and the background recheck scheduler below hand off the exact same
// `domainsService` instance, rather than each wiring an independent copy.
const services = createServices({ db })
const app = createApp({ db }, services)

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, 'API listening')
})

// Disableable via RECHECK_ENABLED — off for most test/dev runs so a
// background timer doesn't tick against a throwaway or short-lived db.
const scheduler = env.RECHECK_ENABLED
  ? createRecheckScheduler({
      domainsService: services.domainsService,
      intervalMs: env.RECHECK_INTERVAL_MS,
      batchSize: env.RECHECK_BATCH_SIZE,
      logger: createChildLogger({ module: 'recheck-scheduler' }),
    })
  : undefined

if (scheduler) {
  scheduler.start()
  logger.info(
    {
      intervalMs: env.RECHECK_INTERVAL_MS,
      batchSize: env.RECHECK_BATCH_SIZE,
    },
    'Recheck scheduler started',
  )
} else {
  logger.info(
    {},
    'RECHECK_ENABLED=false — background recheck scheduler disabled',
  )
}

function shutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal')

  scheduler?.stop()

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during shutdown')
      process.exit(1)
    }
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
