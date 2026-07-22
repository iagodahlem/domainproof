import type {
  CloudflareClient,
  CreateTxtRecordResult,
  ExchangeCodeResult,
  FindZoneResult,
} from '@modules/cloudflare/ports'

/** Cloudflare's self-managed OAuth authorize/token endpoints — see `service.ts`'s `buildAuthorizeUrl` for the authorize half. */
const OAUTH_TOKEN_URL = 'https://dash.cloudflare.com/oauth2/token'

/** Cloudflare's REST API base — stable, versioned, documented at developers.cloudflare.com/api. */
const API_BASE_URL = 'https://api.cloudflare.com/client/v4'

const DEFAULT_TIMEOUT_MS = 10_000

/** The subset of the `fetch` signature this adapter depends on — same injection seam as `infra/http/webhook-sender.ts`'s `FetchLike`. */
type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export interface CloudflareOAuthClientConfig {
  clientId: string
  clientSecret: string
  /** Must exactly match the redirect URI registered on the Cloudflare OAuth client — see README's Cloudflare setup section. */
  redirectUri: string
  /** Request timeout in milliseconds, applied to every call this client makes. */
  timeoutMs?: number
  /** Injectable for tests; defaults to `globalThis.fetch`. Production callers (`app.ts`) never pass this. */
  fetchImpl?: FetchLike
}

interface TokenResponseBody {
  access_token?: unknown
}

interface ZonesResponseBody {
  success?: unknown
  result?: Array<{ id?: unknown; name?: unknown }>
}

interface DnsRecordResponseBody {
  success?: unknown
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

/**
 * Production {@link CloudflareClient}, over `fetch`. This is the only file
 * allowed to talk to Cloudflare's API directly — everything above it
 * (`modules/cloudflare/service.ts`, the frontend routes) depends on the
 * port, never this concrete adapter.
 *
 * Never throws: a timeout, a network error, or a non-2xx/malformed
 * response all map onto each method's own typed `ok: false` result,
 * matching the port's contract (same shape as `infra/http/webhook-sender.ts`
 * and `infra/dns/node-dns.ts`'s error mapping).
 */
export function createCloudflareOAuthClient(
  config: CloudflareOAuthClientConfig,
): CloudflareClient {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl: FetchLike =
    config.fetchImpl ?? (globalThis.fetch as FetchLike)

  async function withTimeout(
    run: (signal: AbortSignal) => Promise<Response>,
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await run(controller.signal)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async exchangeCode({ code, codeVerifier }): Promise<ExchangeCodeResult> {
      try {
        const response = await withTimeout((signal) =>
          fetchImpl(OAUTH_TOKEN_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              redirect_uri: config.redirectUri,
              client_id: config.clientId,
              client_secret: config.clientSecret,
              code_verifier: codeVerifier,
            }).toString(),
            signal,
          }),
        )

        if (!response.ok) {
          return { ok: false, error: 'exchange_failed' }
        }

        const body = (await parseJson(response)) as
          TokenResponseBody | undefined
        const accessToken = body?.access_token
        if (typeof accessToken !== 'string' || accessToken.length === 0) {
          return { ok: false, error: 'exchange_failed' }
        }

        return { ok: true, accessToken }
      } catch {
        return { ok: false, error: 'exchange_failed' }
      }
    },

    async findZoneByName(accessToken, zoneName): Promise<FindZoneResult> {
      try {
        const url = `${API_BASE_URL}/zones?${new URLSearchParams({ name: zoneName }).toString()}`
        const response = await withTimeout((signal) =>
          fetchImpl(url, {
            method: 'GET',
            headers: { authorization: `Bearer ${accessToken}` },
            signal,
          }),
        )

        if (!response.ok) {
          return { ok: false, error: 'request_failed' }
        }

        const body = (await parseJson(response)) as
          ZonesResponseBody | undefined
        const [zone] = body?.result ?? []
        if (
          !zone ||
          typeof zone.id !== 'string' ||
          typeof zone.name !== 'string'
        ) {
          return { ok: false, error: 'not_found' }
        }

        return { ok: true, zone: { id: zone.id, name: zone.name } }
      } catch {
        return { ok: false, error: 'request_failed' }
      }
    },

    async createTxtRecord(
      accessToken,
      zoneId,
      record,
    ): Promise<CreateTxtRecordResult> {
      try {
        const response = await withTimeout((signal) =>
          fetchImpl(`${API_BASE_URL}/zones/${zoneId}/dns_records`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              type: 'TXT',
              name: record.name,
              content: record.content,
            }),
            signal,
          }),
        )

        if (!response.ok) {
          return { ok: false, error: 'request_failed' }
        }

        const body = (await parseJson(response)) as
          DnsRecordResponseBody | undefined
        if (body?.success !== true) {
          return { ok: false, error: 'request_failed' }
        }

        return { ok: true }
      } catch {
        return { ok: false, error: 'request_failed' }
      }
    },
  }
}
