import { createHash, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { generateToken } from '@domainproof/core'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, type AppDependencies } from '../../../app'
import { env } from '../../../env'
import { createDb, type Database } from '@infra/db/client'
import { accounts, apiKeys, projects } from '@infra/db/schema'
import { generateKeyId } from '@modules/keys/domain/encoding'
import type { CloudflareClient } from '@modules/cloudflare/ports'
import { uniqueSlug } from '@shared/testing/unique-slug'

/**
 * End-to-end coverage of the Cloudflare one-click DNS setup flow: claims a
 * real domain through `/v1/domains`, drives the authorize redirect and
 * callback exactly as a browser would (extracting `state` from the
 * authorize redirect's `Location` header, feeding it back to the
 * callback), against a real db throughout and a fake `CloudflareClient`
 * standing in for Cloudflare's own API, since the real OAuth client
 * doesn't exist yet.
 */
const db: Database = createDb(
  process.env.DATABASE_URL ??
    'postgres://domainproof:domainproof@localhost:5432/domainproof',
)
const createdClerkUserIds: string[] = []

const CLOUDFLARE_CONFIG = {
  cloudflareOAuthClientId: 'test-client-id',
  cloudflareOAuthClientSecret: 'test-client-secret',
}

const SENTINEL_ACCESS_TOKEN = 'SENTINEL-CF-ACCESS-TOKEN-DO-NOT-LOG'
const SENTINEL_AUTH_CODE = 'SENTINEL-AUTH-CODE-DO-NOT-LOG'

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

async function createTestApiKey(
  overrides: { mode?: 'test' | 'live' } = {},
): Promise<{ projectId: string; key: string }> {
  const mode = overrides.mode ?? 'test'
  const clerkUserId = `user_${randomUUID()}`
  createdClerkUserIds.push(clerkUserId)

  const [account] = await db
    .insert(accounts)
    .values({ clerkUserId })
    .returning({ id: accounts.id })
  if (!account) throw new Error('failed to create test account')

  const [project] = await db
    .insert(projects)
    .values({
      accountId: account.id,
      name: 'Cloudflare OAuth Test',
      slug: uniqueSlug('cft'),
    })
    .returning({ id: projects.id })
  if (!project) throw new Error('failed to create test project')

  const keyId = generateKeyId()
  const secret = generateToken()
  await db.insert(apiKeys).values({
    projectId: project.id,
    mode,
    keyId,
    secretHash: hashSecret(secret),
    last4: secret.slice(-4),
    name: null,
  })

  return { projectId: project.id, key: `dp_${mode}_${keyId}_${secret}` }
}

function fakeCloudflareClient(
  overrides: Partial<CloudflareClient> = {},
): CloudflareClient {
  return {
    async exchangeCode() {
      return { ok: true, accessToken: SENTINEL_ACCESS_TOKEN }
    },
    async findZoneByName() {
      return { ok: true, zone: { id: 'zone_1', name: 'verified.test' } }
    },
    async createTxtRecord() {
      return { ok: true }
    },
    ...overrides,
  }
}

function buildApp(
  overrides: Partial<AppDependencies> = {},
): ReturnType<typeof createApp> {
  return createApp({ db, ...overrides })
}

function buildCloudflareApp(
  cloudflareClient: CloudflareClient = fakeCloudflareClient(),
): ReturnType<typeof createApp> {
  return buildApp({ ...CLOUDFLARE_CONFIG, cloudflareClient })
}

function tokenFromVerificationUrl(verificationUrl: string): string {
  const token = verificationUrl.split('/').pop()
  if (!token)
    throw new Error(`could not parse a token out of ${verificationUrl}`)
  return token
}

async function claimDomain(
  app: ReturnType<typeof buildApp>,
  key: string,
  domain: string,
): Promise<string> {
  const res = await app.request('/v1/domains', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ domain }),
  })
  expect(res.status).toBe(201)
  const body = (await res.json()) as { domain: { verificationUrl: string } }
  return tokenFromVerificationUrl(body.domain.verificationUrl)
}

/** Extracts `state` from the authorize redirect's `Location` header, as a browser following the redirect would carry it through to Cloudflare and back. */
async function getAuthorizeState(
  app: ReturnType<typeof buildApp>,
  token: string,
): Promise<string> {
  const res = await app.request(
    `/frontend/verifications/${token}/cloudflare/authorize`,
    { redirect: 'manual' },
  )
  expect(res.status).toBe(302)
  const location = res.headers.get('Location')
  if (!location) throw new Error('authorize redirect had no Location header')
  const url = new URL(location)
  expect(url.origin + url.pathname).toBe(
    'https://dash.cloudflare.com/oauth2/auth',
  )
  const state = url.searchParams.get('state')
  if (!state) throw new Error('authorize redirect had no state param')
  return state
}

async function callback(
  app: ReturnType<typeof buildApp>,
  params: Record<string, string>,
): Promise<Response> {
  const query = new URLSearchParams(params).toString()
  return app.request(`/frontend/cloudflare/callback?${query}`, {
    redirect: 'manual',
  })
}

function outcomeFromRedirect(res: Response): string {
  const location = res.headers.get('Location')
  if (!location) throw new Error('callback response had no Location header')
  return new URL(location).searchParams.get('cloudflare') ?? ''
}

describe('Cloudflare one-click DNS setup', () => {
  afterEach(async () => {
    while (createdClerkUserIds.length > 0) {
      const clerkUserId = createdClerkUserIds.pop()
      if (clerkUserId) {
        await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId))
      }
    }
  })

  describe('unset env (not configured)', () => {
    it('404s the authorize route with not_configured, boot unaffected', async () => {
      const app = buildApp()
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'unconfigured-1.test')

      const res = await app.request(
        `/frontend/verifications/${token}/cloudflare/authorize`,
      )

      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_configured')
    })

    it('404s the callback route with not_configured', async () => {
      const app = buildApp()

      const res = await app.request(
        '/frontend/cloudflare/callback?code=x&state=y',
      )

      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('not_configured')
    })
  })

  describe('authorize', () => {
    it('redirects to Cloudflare with PKCE and a signed state, 404s for an unknown token', async () => {
      const app = buildCloudflareApp()
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'authorize-shape.test')

      const res = await app.request(
        `/frontend/verifications/${token}/cloudflare/authorize`,
        { redirect: 'manual' },
      )

      expect(res.status).toBe(302)
      const url = new URL(res.headers.get('Location') ?? '')
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('client_id')).toBe(
        CLOUDFLARE_CONFIG.cloudflareOAuthClientId,
      )
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      expect(url.searchParams.get('code_challenge')).toBeTruthy()
      expect(url.searchParams.get('state')).toBeTruthy()

      const unknownRes = await app.request(
        '/frontend/verifications/unknown-token/cloudflare/authorize',
      )
      expect(unknownRes.status).toBe(404)
      const unknownBody = (await unknownRes.json()) as {
        error: { code: string }
      }
      expect(unknownBody.error.code).toBe('not_found')
    })
  })

  describe('callback happy path', () => {
    it('exchanges the code, matches the zone, creates the record, publishes dns_autoconfigured, and triggers verify', async () => {
      let createTxtRecordArgs: unknown
      const cloudflareClient = fakeCloudflareClient({
        async createTxtRecord(accessToken, zoneId, record) {
          createTxtRecordArgs = { accessToken, zoneId, record }
          return { ok: true }
        },
      })
      const app = buildCloudflareApp(cloudflareClient)
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'verified.test')
      const state = await getAuthorizeState(app, token)

      const res = await callback(app, {
        code: SENTINEL_AUTH_CODE,
        state,
      })

      expect(res.status).toBe(302)
      const location = res.headers.get('Location') ?? ''
      // Built from `env.VERIFICATION_BASE_URL` rather than a hardcoded
      // host, since its default is NODE_ENV-aware.
      expect(location).toContain(`${env.VERIFICATION_BASE_URL}/${token}`)
      expect(outcomeFromRedirect(res)).toBe('success')

      expect(createTxtRecordArgs).toMatchObject({
        accessToken: SENTINEL_ACCESS_TOKEN,
        zoneId: 'zone_1',
      })

      // The standard verify path ran: `verified.test`'s sandbox journey
      // always returns the correct record, so the claim is now verified.
      const verificationRes = await app.request(
        `/frontend/verifications/${token}`,
      )
      const verification = (await verificationRes.json()) as {
        status: string
      }
      expect(verification.status).toBe('verified')

      // `domain.dns_autoconfigured` landed in the timeline ahead of the
      // verify path's own check_passed/verified events.
      const eventsRes = await app.request(
        `/frontend/verifications/${token}/events`,
      )
      const events = (await eventsRes.json()) as {
        events: Array<{ type: string }>
      }
      const types = events.events.map((e) => e.type)
      expect(types).toContain('domain.dns_autoconfigured')
      expect(types.indexOf('domain.dns_autoconfigured')).toBeLessThan(
        types.indexOf('domain.verified'),
      )
    })
  })

  describe('failure branches', () => {
    it('denied: redirects with cloudflare=denied and never exchanges a code', async () => {
      let exchangeCalled = false
      const cloudflareClient = fakeCloudflareClient({
        async exchangeCode() {
          exchangeCalled = true
          return { ok: true, accessToken: SENTINEL_ACCESS_TOKEN }
        },
      })
      const app = buildCloudflareApp(cloudflareClient)
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'denied.test')
      const state = await getAuthorizeState(app, token)

      const res = await callback(app, { error: 'access_denied', state })

      expect(res.status).toBe(302)
      expect(outcomeFromRedirect(res)).toBe('denied')
      expect(exchangeCalled).toBe(false)
    })

    it('exchange_failed: redirects with cloudflare=exchange_failed', async () => {
      const cloudflareClient = fakeCloudflareClient({
        async exchangeCode() {
          return { ok: false, error: 'exchange_failed' }
        },
      })
      const app = buildCloudflareApp(cloudflareClient)
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'exchange-fail.test')
      const state = await getAuthorizeState(app, token)

      const res = await callback(app, { code: SENTINEL_AUTH_CODE, state })

      expect(res.status).toBe(302)
      expect(outcomeFromRedirect(res)).toBe('exchange_failed')
    })

    it('no_matching_zone: redirects with cloudflare=no_matching_zone', async () => {
      const cloudflareClient = fakeCloudflareClient({
        async findZoneByName() {
          return { ok: false, error: 'not_found' }
        },
      })
      const app = buildCloudflareApp(cloudflareClient)
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'no-zone.test')
      const state = await getAuthorizeState(app, token)

      const res = await callback(app, { code: SENTINEL_AUTH_CODE, state })

      expect(res.status).toBe(302)
      expect(outcomeFromRedirect(res)).toBe('no_matching_zone')
    })

    it('record_create_failed: redirects with cloudflare=record_create_failed, no event published', async () => {
      const cloudflareClient = fakeCloudflareClient({
        async createTxtRecord() {
          return { ok: false, error: 'request_failed' }
        },
      })
      const app = buildCloudflareApp(cloudflareClient)
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'record-fail.test')
      const state = await getAuthorizeState(app, token)

      const res = await callback(app, { code: SENTINEL_AUTH_CODE, state })

      expect(res.status).toBe(302)
      expect(outcomeFromRedirect(res)).toBe('record_create_failed')

      const eventsRes = await app.request(
        `/frontend/verifications/${token}/events`,
      )
      const events = (await eventsRes.json()) as {
        events: Array<{ type: string }>
      }
      expect(events.events.map((e) => e.type)).not.toContain(
        'domain.dns_autoconfigured',
      )
    })
  })

  describe('state tampering', () => {
    it('rejects a tampered state with 400, not a redirect', async () => {
      const app = buildCloudflareApp()
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'tampered.test')
      const state = await getAuthorizeState(app, token)

      const res = await callback(app, {
        code: SENTINEL_AUTH_CODE,
        state: `${state}corrupted`,
      })

      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('invalid_request')
    })

    it('rejects a missing state with 400', async () => {
      const app = buildCloudflareApp()

      const res = await callback(app, { code: SENTINEL_AUTH_CODE })

      expect(res.status).toBe(400)
    })
  })

  describe('grant redaction', () => {
    it('never includes the access token, code, or state in any response body', async () => {
      const app = buildCloudflareApp()
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'redaction.test')
      const state = await getAuthorizeState(app, token)

      const res = await callback(app, { code: SENTINEL_AUTH_CODE, state })
      const bodyText = await res.text()
      const location = res.headers.get('Location') ?? ''

      for (const secret of [SENTINEL_ACCESS_TOKEN, SENTINEL_AUTH_CODE, state]) {
        expect(bodyText).not.toContain(secret)
        expect(location).not.toContain(secret)
      }
    })

    it('never writes the access token, code, or state to the request logger', async () => {
      const app = buildCloudflareApp()
      const apiKey = await createTestApiKey()
      const token = await claimDomain(app, apiKey.key, 'log-redaction.test')
      const state = await getAuthorizeState(app, token)

      const writes: string[] = []
      const originalWrite = process.stdout.write.bind(process.stdout)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      process.stdout.write = ((chunk: any, ...rest: any[]) => {
        writes.push(String(chunk))
        return originalWrite(chunk, ...rest)
      }) as typeof process.stdout.write

      try {
        await callback(app, { code: SENTINEL_AUTH_CODE, state })
      } finally {
        process.stdout.write = originalWrite
      }

      const logged = writes.join('')
      expect(logged).not.toContain(SENTINEL_ACCESS_TOKEN)
      expect(logged).not.toContain(SENTINEL_AUTH_CODE)
      expect(logged).not.toContain(state)
    })
  })
})
