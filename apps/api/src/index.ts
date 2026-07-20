import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createDb } from '@infra/db/client'
import { runMigrations } from '@infra/db/migrate'
import { createApp } from './app'
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
  console.log('Migrations applied')
} catch (err) {
  console.error('Migration failed, exiting', err)
  process.exit(1)
}

const app = createApp({ db })

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on port ${info.port}`)
})

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down`)

  server.close((err) => {
    if (err) {
      console.error('Error during shutdown', err)
      process.exit(1)
    }
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
