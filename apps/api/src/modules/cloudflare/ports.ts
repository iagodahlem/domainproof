/**
 * Module-owned port for the three Cloudflare API calls this module's
 * service needs to complete the one-click DNS setup flow: exchange an
 * OAuth code for an access token, find the zone that owns a claim's
 * domain, and create the exact TXT record the claim's challenge already
 * specifies. Grouped into one port (rather than three, or a generic
 * "Cloudflare fetcher") because every implementation shares the same base
 * URL, auth headers, and error-mapping shape — see
 * `infra/cloudflare/oauth-client.ts`, the only file allowed to talk to
 * Cloudflare's API directly (ARCHITECTURE.md's "any external API is an
 * infra adapter sitting behind a port" rule).
 *
 * Every method takes the bearer access token as an explicit argument
 * rather than baking it into the client at construction time: the token is
 * minted once per callback request (see `service.ts`'s `handleCallback`)
 * and used-and-discarded within that same request — there is no
 * longer-lived client instance it could be bound to.
 */
export interface CloudflareClient {
  /**
   * Exchanges an authorization code for an access token at Cloudflare's
   * token endpoint, completing the PKCE handshake with `codeVerifier`.
   * `ok: false` covers every failure this module treats identically
   * (network error, non-2xx response, a malformed token response) — the
   * caller only ever needs to know whether it got a usable access token,
   * not why it didn't.
   */
  exchangeCode(input: {
    code: string
    codeVerifier: string
  }): Promise<ExchangeCodeResult>

  /**
   * Finds the zone (if any) in the authorizing account whose name exactly
   * matches `zoneName` — callers pass the claim domain's *registrable*
   * domain (see `@domainproof/core`'s `registrableDomain`), matching how
   * Cloudflare zones are always named after a registrable domain, never a
   * subdomain.
   */
  findZoneByName(accessToken: string, zoneName: string): Promise<FindZoneResult>

  /** Creates a TXT record in `zoneId` with the given host label and value. */
  createTxtRecord(
    accessToken: string,
    zoneId: string,
    record: { name: string; content: string },
  ): Promise<CreateTxtRecordResult>
}

export type ExchangeCodeResult =
  { ok: true; accessToken: string } | { ok: false; error: 'exchange_failed' }

export interface CloudflareZone {
  id: string
  name: string
}

export type FindZoneResult =
  | { ok: true; zone: CloudflareZone }
  | { ok: false; error: 'not_found' | 'request_failed' }

export type CreateTxtRecordResult =
  { ok: true } | { ok: false; error: 'request_failed' }
