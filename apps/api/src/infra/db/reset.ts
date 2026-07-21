import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { env } from '../../env'
import { createDb } from './client'
import { runMigrations } from './migrate'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Drops and recreates the `public` schema on `DATABASE_URL`, then reapplies
 * every migration from scratch. Destructive by design (dev-only — data
 * everywhere is throwaway right now), so it refuses to run unless the
 * caller opts in explicitly, and always names the target host first so a
 * misconfigured `DATABASE_URL` is obvious before anything runs.
 *
 * Plain `console.*`, not the pino logger, deliberately: this is a `pnpm
 * db:reset` CLI script run directly by a developer in a terminal — its
 * stdout is the interface, not a service log stream meant for
 * aggregation.
 */
async function main() {
  const host = new URL(env.DATABASE_URL).host
  console.log(`db:reset targeting ${host}`)

  const confirmed =
    process.argv.includes('--yes') || process.env.DB_RESET_CONFIRM === '1'

  if (!confirmed) {
    console.error(
      'Refusing to reset without confirmation — pass --yes or set DB_RESET_CONFIRM=1',
    )
    process.exit(1)
  }

  const client = postgres(env.DATABASE_URL)
  try {
    await client.unsafe('DROP SCHEMA public CASCADE')
    await client.unsafe('CREATE SCHEMA public')
    // The migrator tracks applied migrations in its own `drizzle` schema,
    // separate from `public` — drop it too, or the migrator sees the old
    // hash as already applied and skips reapplying the SQL below, leaving
    // `public` empty.
    await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
  } finally {
    await client.end()
  }

  const db = createDb(env.DATABASE_URL)
  await runMigrations(db, join(__dirname, '..', '..', '..', 'drizzle'))

  console.log('Database reset and migrations applied')
  // drizzle's postgres-js migrator leaves its connection pool open
  // (nothing else in this script needs it), so the process won't exit on
  // its own without this.
  process.exit(0)
}

main().catch((err) => {
  console.error('db:reset failed', err)
  process.exit(1)
})
