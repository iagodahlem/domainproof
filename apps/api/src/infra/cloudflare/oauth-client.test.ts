import { describe, expect, it } from 'vitest'
import { createCloudflareOAuthClient } from './oauth-client'

const CONFIG = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://verify.domainproof.dev/frontend/cloudflare/callback',
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

function fakeFetch(handler: (url: string, init: RequestInit) => Response): {
  fetchImpl: FetchLike
  calls: Array<{ url: string; init: RequestInit }>
} {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init })
    return handler(url, init)
  }
  return { fetchImpl, calls }
}

describe('createCloudflareOAuthClient', () => {
  describe('exchangeCode', () => {
    it('returns the access token on a successful exchange', async () => {
      const { fetchImpl, calls } = fakeFetch((url) => {
        expect(url).toBe('https://dash.cloudflare.com/oauth2/token')
        return Response.json({ access_token: 'cf-token-abc' })
      })
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.exchangeCode({
        code: 'auth-code',
        codeVerifier: 'verifier',
      })

      expect(result).toEqual({ ok: true, accessToken: 'cf-token-abc' })

      const body = new URLSearchParams(calls[0]?.init.body as string)
      expect(body.get('grant_type')).toBe('authorization_code')
      expect(body.get('code')).toBe('auth-code')
      expect(body.get('code_verifier')).toBe('verifier')
      expect(body.get('client_id')).toBe(CONFIG.clientId)
      expect(body.get('client_secret')).toBe(CONFIG.clientSecret)
      expect(body.get('redirect_uri')).toBe(CONFIG.redirectUri)
    })

    it('reports exchange_failed on a non-2xx response', async () => {
      const { fetchImpl } = fakeFetch(() => new Response(null, { status: 400 }))
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.exchangeCode({
        code: 'bad-code',
        codeVerifier: 'verifier',
      })

      expect(result).toEqual({ ok: false, error: 'exchange_failed' })
    })

    it('reports exchange_failed when the response has no access_token', async () => {
      const { fetchImpl } = fakeFetch(() => Response.json({}))
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.exchangeCode({
        code: 'code',
        codeVerifier: 'verifier',
      })

      expect(result).toEqual({ ok: false, error: 'exchange_failed' })
    })

    it('reports exchange_failed on a network error, without throwing', async () => {
      const fetchImpl: FetchLike = async () => {
        throw new Error('connect ECONNREFUSED')
      }
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.exchangeCode({
        code: 'code',
        codeVerifier: 'verifier',
      })

      expect(result).toEqual({ ok: false, error: 'exchange_failed' })
    })
  })

  describe('findZoneByName', () => {
    it('returns the matching zone', async () => {
      const { fetchImpl, calls } = fakeFetch((url) => {
        expect(url).toContain('/zones?name=acme.co')
        return Response.json({
          success: true,
          result: [{ id: 'zone-1', name: 'acme.co' }],
        })
      })
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.findZoneByName('cf-token', 'acme.co')

      expect(result).toEqual({
        ok: true,
        zone: { id: 'zone-1', name: 'acme.co' },
      })
      expect(calls[0]?.init.headers).toMatchObject({
        authorization: 'Bearer cf-token',
      })
    })

    it('reports not_found when no zone matches', async () => {
      const { fetchImpl } = fakeFetch(() =>
        Response.json({ success: true, result: [] }),
      )
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.findZoneByName('cf-token', 'nope.com')

      expect(result).toEqual({ ok: false, error: 'not_found' })
    })

    it('reports request_failed on a non-2xx response', async () => {
      const { fetchImpl } = fakeFetch(() => new Response(null, { status: 403 }))
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.findZoneByName('cf-token', 'acme.co')

      expect(result).toEqual({ ok: false, error: 'request_failed' })
    })
  })

  describe('createTxtRecord', () => {
    it('reports ok on success', async () => {
      const { fetchImpl, calls } = fakeFetch((url) => {
        expect(url).toBe(
          'https://api.cloudflare.com/client/v4/zones/zone-1/dns_records',
        )
        return Response.json({ success: true })
      })
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.createTxtRecord('cf-token', 'zone-1', {
        name: '_acme-challenge.acme.co',
        content: 'acme-verify=abc',
      })

      expect(result).toEqual({ ok: true })
      const body = JSON.parse(calls[0]?.init.body as string) as unknown
      expect(body).toEqual({
        type: 'TXT',
        name: '_acme-challenge.acme.co',
        content: 'acme-verify=abc',
      })
    })

    it('reports request_failed when the api reports success: false', async () => {
      const { fetchImpl } = fakeFetch(() => Response.json({ success: false }))
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.createTxtRecord('cf-token', 'zone-1', {
        name: '_acme-challenge.acme.co',
        content: 'acme-verify=abc',
      })

      expect(result).toEqual({ ok: false, error: 'request_failed' })
    })

    it('reports request_failed on a non-2xx response', async () => {
      const { fetchImpl } = fakeFetch(() => new Response(null, { status: 500 }))
      const client = createCloudflareOAuthClient({ ...CONFIG, fetchImpl })

      const result = await client.createTxtRecord('cf-token', 'zone-1', {
        name: '_acme-challenge.acme.co',
        content: 'acme-verify=abc',
      })

      expect(result).toEqual({ ok: false, error: 'request_failed' })
    })
  })
})
