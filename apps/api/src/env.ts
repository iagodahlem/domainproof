import { z } from 'zod'

// A bare hostname — no scheme, no path, no port. Rejects `https://...` and
// `api.domainproof.dev/` by construction: neither `/` nor `:` is in the
// allowed character set.
const bareHostnamePattern =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i

const bareHostname = z
  .string()
  .min(1)
  .regex(bareHostnamePattern, 'must be a bare hostname, not a URL')

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Both optional for now: routes/middleware that need Clerk auth fail fast
  // with a clear 500 if these aren't configured, rather than the app
  // refusing to boot before Clerk is wired up everywhere.
  CLERK_JWKS_URL: z.string().url().optional(),
  CLERK_ISSUER: z.string().min(1).optional(),
  // Both optional: unset means no host restriction, which is what keeps
  // local dev, tests, and the Railway service domain unrestricted (both
  // planes reachable on one origin). See
  // `shared/middlewares/host-restriction.ts`.
  PUBLIC_API_HOST: bareHostname.optional(),
  DASHBOARD_API_HOST: bareHostname.optional(),
  FRONTEND_API_HOST: bareHostname.optional(),
  // Optional: the dashboard web app's origin, for the dashboard plane's
  // CORS policy (see apis/dashboard/router.ts) — the only plane a browser
  // calls directly. Unset means any origin is allowed, which is what
  // keeps local dev (web on whatever port) and tests working without
  // configuration.
  WEB_ORIGIN: z.string().url().optional(),
  // Optional: unset means the email notification subscribers aren't
  // registered at all (see `app.ts`) — a clean log-and-skip, not a crash,
  // since dev/test environments won't have this configured. See
  // `infra/email/resend.ts`.
  RESEND_API_KEY: z.string().min(1).optional(),
  // Optional, defaults to the address this repo's Resend domain is
  // verified for.
  EMAIL_FROM: z
    .string()
    .min(1)
    .default('DomainProof <notifications@domainproof.dev>'),
  // Verbosity for `infra/logging/logger.ts`'s pino instance. `debug`
  // additionally logs sanitized request/response payloads (see
  // `shared/middlewares/request-logger.ts`) — never secrets, but noisy, so
  // it's opt-in rather than the default.
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  // Total attempts (including the first) before a webhook delivery is
  // marked `failed` for good — see `modules/webhooks/service.ts`'s
  // `DEFAULT_MAX_ATTEMPTS` for the default this overrides.
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().optional(),
  // Optional, defaults to enabled. Set to "false" to disable the
  // background recheck scheduler (workers/) — e.g. for a
  // short-lived test/dev db that shouldn't have a timer ticking against
  // it after the process it was created for exits.
  RECHECK_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .default('true')
    .transform((value) => value === 'true'),
  // Optional. How often the recheck scheduler ticks, and how many domains
  // each of a tick's two batches (recheck, grace-window expiry) processes
  // at most — see `workers/recheck-scheduler.ts`.
  RECHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  RECHECK_BATCH_SIZE: z.coerce.number().int().positive().default(10),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source)

  if (!parsed.success) {
    // Deliberately plain console output, not the pino logger: this runs
    // before `env` itself exists, and `infra/logging/logger.ts` reads
    // `LOG_LEVEL` off the very env this branch just failed to produce —
    // there's no validated config yet to build a logger from.
    console.error(
      'Invalid environment configuration:',
      parsed.error.flatten().fieldErrors,
    )
    throw new Error('Invalid environment configuration')
  }

  return parsed.data
}

export const env = loadEnv()
