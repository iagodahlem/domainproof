import { migrate } from 'drizzle-orm/postgres-js/migrator'
import type { Database } from './client'

/**
 * Applies any pending migrations in `migrationsFolder` against `db`.
 * Idempotent via drizzle's journal — safe to run on every boot alongside
 * `db:migrate` in CI/compose.
 */
export async function runMigrations(db: Database, migrationsFolder: string) {
  await migrate(db, { migrationsFolder })
}
