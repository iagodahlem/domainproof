import { DomainProofApiError, parseApiError } from './errors'
import type {
  ClaimDomainInput,
  ComponentSession,
  CreateComponentSessionInput,
  Domain,
  DomainPage,
  EventPage,
  ListDomainsParams,
  ListEventsParams,
  VerifyDomainResult,
} from './types'
import type { paths } from './generated/openapi-types'

/** Every SDK call returns this instead of throwing — branch on `data`/`error`. */
export type Result<T> =
  { data: T; error: null } | { data: null; error: DomainProofApiError }

export interface DomainProofConfig {
  apiKey: string
  /** Defaults to the production API. Override for local dev, e.g. `http://localhost:3001`. */
  baseUrl?: string
}

const DEFAULT_BASE_URL = 'https://api.domainproof.dev'

function toQueryString(
  params?: Record<string, string | number | undefined>,
): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

/** Unwraps a `{ [key]: T }` envelope response into a bare `Result<T>`. */
function unwrap<K extends string, V>(key: K) {
  return (result: Result<Record<K, V>>): Result<V> =>
    result.error ? result : { data: result.data[key], error: null }
}

interface RequestOptions {
  query?: Record<string, string | number | undefined>
  body?: unknown
}

/**
 * Typed client for DomainProof's public v1 API (`api.domainproof.dev`).
 * Every method returns a {@link Result} instead of throwing.
 */
export class DomainProof {
  private readonly apiKey: string
  private readonly baseUrl: string

  readonly domains: {
    /** `POST /v1/domains` — claims a domain and issues its verification challenge. */
    claim(input: ClaimDomainInput): Promise<Result<Domain>>
    /** `GET /v1/domains` — cursor-paginated list of claimed domains. */
    list(params?: ListDomainsParams): Promise<Result<DomainPage>>
    /** `GET /v1/domains/:id` */
    get(id: string): Promise<Result<Domain>>
    /** `DELETE /v1/domains/:id` — releases a claim. */
    release(id: string): Promise<Result<Domain>>
    /** `POST /v1/domains/:id/verify` — re-runs the DNS check. Safe to poll. */
    verify(id: string): Promise<Result<VerifyDomainResult>>
    /** `POST /v1/domains/:id/regenerate` — fresh challenge for a `pending`/`failed` domain. */
    regenerate(id: string): Promise<Result<Domain>>
    /** `GET /v1/domains/:id/events` — cursor-paginated event timeline. */
    listEvents(
      id: string,
      params?: ListEventsParams,
    ): Promise<Result<EventPage>>
  }

  readonly componentSessions: {
    /** `POST /v1/component-sessions` — mints a short-lived, single-use session token. */
    create(
      input?: CreateComponentSessionInput,
    ): Promise<Result<ComponentSession>>
  }

  constructor(config: DomainProofConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL

    this.domains = {
      claim: (input) => {
        const body = {
          domain: input.domain,
          external_id: input.externalId,
        } satisfies paths['/v1/domains']['post']['requestBody']['content']['application/json']

        return this.request<{ domain: Domain }>('POST', '/v1/domains', {
          body,
        }).then(unwrap('domain'))
      },
      list: (params = {}) =>
        this.request<DomainPage>('GET', '/v1/domains', {
          query: {
            limit: params.limit,
            cursor: params.cursor,
            external_id: params.externalId,
            domain: params.domain,
          },
        }),
      get: (id) =>
        this.request<{ domain: Domain }>(
          'GET',
          `/v1/domains/${encodeURIComponent(id)}`,
        ).then(unwrap('domain')),
      release: (id) =>
        this.request<{ domain: Domain }>(
          'DELETE',
          `/v1/domains/${encodeURIComponent(id)}`,
        ).then(unwrap('domain')),
      verify: (id) =>
        this.request<VerifyDomainResult>(
          'POST',
          `/v1/domains/${encodeURIComponent(id)}/verify`,
        ),
      regenerate: (id) =>
        this.request<{ domain: Domain }>(
          'POST',
          `/v1/domains/${encodeURIComponent(id)}/regenerate`,
        ).then(unwrap('domain')),
      listEvents: (id, params = {}) =>
        this.request<EventPage>(
          'GET',
          `/v1/domains/${encodeURIComponent(id)}/events`,
          { query: { limit: params.limit, cursor: params.cursor } },
        ),
    }

    this.componentSessions = {
      create: (input = {}) => {
        const body = {
          externalId: input.externalId,
        } satisfies paths['/v1/component-sessions']['post']['requestBody']['content']['application/json']

        return this.request<ComponentSession>(
          'POST',
          '/v1/component-sessions',
          { body },
        )
      },
    }
  }

  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<Result<T>> {
    const url = `${this.baseUrl}${path}${toQueryString(options.query)}`

    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(options.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })
    } catch (err) {
      return {
        data: null,
        error: new DomainProofApiError(
          'network_error',
          err instanceof Error ? err.message : 'Network request failed',
          0,
        ),
      }
    }

    const json: unknown = await res.json().catch(() => null)

    if (!res.ok) {
      return {
        data: null,
        error: parseApiError(json, res.statusText, res.status),
      }
    }

    return { data: json as T, error: null }
  }
}
