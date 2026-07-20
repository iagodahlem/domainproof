import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = ReturnType<typeof createDb>

/**
 * Drizzle client factory. Takes an explicit connection string rather than
 * reading `process.env` directly so tests and scripts can point it at a
 * different database without mutating global env state.
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString)
  return drizzle(client, { schema })
}
