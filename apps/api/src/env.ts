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
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source)

  if (!parsed.success) {
    console.error(
      'Invalid environment configuration:',
      parsed.error.flatten().fieldErrors,
    )
    throw new Error('Invalid environment configuration')
  }

  return parsed.data
}

export const env = loadEnv()
