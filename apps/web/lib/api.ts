/**
 * Small typed client for the dashboard API plane. Every non-2xx response
 * follows `{ error: { code, message } }` (see the repo's architecture
 * rules) — this is the one place that shape is parsed, so callers never
 * see raw fetch/JSON plumbing.
 */

export class ApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export interface ProjectSummary {
  id: string
  name: string
  slug: string
  createdAt: string
}

export type ApiKeyMode = 'test' | 'live'

/** Same `test`/`live` split as `ApiKeyMode`, named for the domain-claim call sites that don't otherwise involve a key. */
export type DomainMode = ApiKeyMode

export type DomainStatus =
  'not_started' | 'pending' | 'verified' | 'temporarily_failed' | 'failed'

export interface DomainSummary {
  id: string
  domain: string
  mode: DomainMode
  status: DomainStatus
  /** The current challenge's verification method (e.g. `dns_txt`), `null` if a domain somehow has none. */
  method: string | null
  createdAt: string
  updatedAt: string
  verifiedAt: string | null
}

export interface DomainRecord {
  type: string
  name: string
  value: string
  status: string
}

export interface DomainDetail extends DomainSummary {
  verificationUrl: string
  records: DomainRecord[]
}

export interface DomainCheck {
  outcome: string
  checkedAt: string
  /** Only present when `outcome === 'wrong_value'`. */
  expected?: string
  detected?: string[]
}

export interface DomainEvent {
  id: string
  type: string
  mode: DomainMode
  payload: unknown
  createdAt: string
}

export interface ListPageOptions {
  limit?: number
  cursor?: string
}

export interface ApiKeyListItem {
  keyId: string
  mode: ApiKeyMode
  /** `dp_<mode>_<keyId>_...<last4>` — enough to recognize the key, never the secret. */
  maskedKey: string
  last4: string
  name: string | null
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export interface CreateKeyResult {
  /** The full `dp_<mode>_<keyId>_<secret>` key. Shown exactly once. */
  key: string
  apiKey: ApiKeyListItem
}

export interface CreateProjectResult {
  project: ProjectSummary
  keys: {
    test: CreateKeyResult
    live: CreateKeyResult
  }
}

function withQuery(path: string, options?: ListPageOptions): string {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.cursor) params.set('cursor', options.cursor)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured')
  }
  return url
}

async function request<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  })

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorBody = body as {
      error?: { code?: string; message?: string }
    } | null
    throw new ApiError(
      errorBody?.error?.code ?? 'unknown_error',
      errorBody?.error?.message ?? 'Something went wrong. Please try again.',
      response.status,
    )
  }

  return body as T
}

/**
 * Session-authenticated dashboard routes (`/dashboard/*`) — every call
 * takes the caller's Clerk session token explicitly rather than reaching
 * for a global, since some callers are server components/actions and
 * others are client components using `useAuth().getToken()`.
 */
export const dashboardApi = {
  listProjects(token: string | null) {
    return request<{ projects: ProjectSummary[] }>('/dashboard/projects', token)
  },

  createProject(token: string | null, name: string) {
    return request<CreateProjectResult>('/dashboard/projects', token, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  listDomains(
    token: string | null,
    projectId: string,
    options?: ListPageOptions,
  ) {
    return request<{ domains: DomainSummary[]; nextCursor: string | null }>(
      withQuery(`/dashboard/projects/${projectId}/domains`, options),
      token,
    )
  },

  createDomain(
    token: string | null,
    projectId: string,
    input: { domain: string; mode: DomainMode },
  ) {
    return request<{ domain: DomainDetail }>(
      `/dashboard/projects/${projectId}/domains`,
      token,
      { method: 'POST', body: JSON.stringify(input) },
    )
  },

  getDomain(token: string | null, projectId: string, domainId: string) {
    return request<{ domain: DomainDetail }>(
      `/dashboard/projects/${projectId}/domains/${domainId}`,
      token,
    )
  },

  listDomainEvents(
    token: string | null,
    projectId: string,
    domainId: string,
    options?: ListPageOptions,
  ) {
    return request<{ events: DomainEvent[]; nextCursor: string | null }>(
      withQuery(
        `/dashboard/projects/${projectId}/domains/${domainId}/events`,
        options,
      ),
      token,
    )
  },

  verifyDomain(token: string | null, projectId: string, domainId: string) {
    return request<{ domain: DomainDetail; check: DomainCheck }>(
      `/dashboard/projects/${projectId}/domains/${domainId}/verify`,
      token,
      { method: 'POST' },
    )
  },

  regenerateDomain(token: string | null, projectId: string, domainId: string) {
    return request<{ domain: DomainDetail }>(
      `/dashboard/projects/${projectId}/domains/${domainId}/regenerate`,
      token,
      { method: 'POST' },
    )
  },

  deleteDomain(token: string | null, projectId: string, domainId: string) {
    return request<{ domain: DomainDetail }>(
      `/dashboard/projects/${projectId}/domains/${domainId}`,
      token,
      { method: 'DELETE' },
    )
  },
}
