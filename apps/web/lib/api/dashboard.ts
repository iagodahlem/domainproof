/**
 * Session-authenticated dashboard routes (`/dashboard/*`) — every call
 * takes the caller's Clerk session token explicitly rather than reaching
 * for a global, since some callers are server components/actions and
 * others are client components using `useAuth().getToken()`.
 */

import { request } from './request'

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

/** DNS providers the dashboard can recognize and show in the domains table's Provider column — mirrors `@domainproof/core`'s `Provider`. `'unknown'` covers both a real but undetected provider and a `.test` sandbox domain (see `domain-provider.tsx`, which tells those apart from the domain name itself). */
export type Provider = 'cloudflare' | 'unknown'

/** A domains-list row: `DomainSummary` plus the Provider column's own data — only the list route resolves this (a domain-detail fetch has no table cell to fill), so it's kept separate rather than added to `DomainSummary` itself. */
export interface DomainListItem extends DomainSummary {
  provider: Provider
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

export type Mode = 'test' | 'live'

/** Every event type a webhook endpoint can subscribe to — mirrors `apps/api`'s `WEBHOOK_EVENT_TYPES` (every `DomainEventType` except the account-scoped `account.created`). */
export const WEBHOOK_EVENT_TYPES = [
  'domain.claimed',
  'domain.challenge_regenerated',
  'domain.check_passed',
  'domain.check_failed',
  'domain.verified',
  'domain.temporarily_failed',
  'domain.failed',
] as const

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]

export interface WebhookEndpointSummary {
  id: string
  url: string
  mode: Mode
  eventTypes: WebhookEventType[]
  /** `whsec_...<last4>` — enough to recognize the endpoint's secret, never the full value. */
  maskedSecret: string
  disabled: boolean
  createdAt: string
}

export interface CreateWebhookEndpointResult {
  endpoint: WebhookEndpointSummary
  /** The full `whsec_...` signing secret. Shown in full only here, at creation. */
  secret: string
}

export interface WebhookDeliverySummary {
  id: string
  endpointId: string
  eventType: string
  attempt: number
  status: 'pending' | 'succeeded' | 'failed'
  responseStatus: number | null
  deliveredAt: string | null
  nextRetryAt: string | null
  createdAt: string
}

export interface ListDeliveriesResult {
  deliveries: WebhookDeliverySummary[]
  /** `null` once the last page has been reached. */
  nextCursor: string | null
}

/** A project-wide events row — every event across all of a project's domains and both modes, newest first. */
export interface ProjectEventSummary {
  id: string
  type: string
  mode: Mode
  domain: string
  payload: unknown
  createdAt: string
}

export interface ListProjectEventsResult {
  events: ProjectEventSummary[]
  /** `null` once the last page has been reached. */
  nextCursor: string | null
}

function toQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  )
  if (entries.length === 0) return ''
  return `?${new URLSearchParams(entries).toString()}`
}

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
    options: ListPageOptions & { mode?: DomainMode } = {},
  ) {
    const query = toQueryString({
      limit: options.limit?.toString(),
      cursor: options.cursor,
      mode: options.mode,
    })
    return request<{ domains: DomainListItem[]; nextCursor: string | null }>(
      `/dashboard/projects/${projectId}/domains${query}`,
      token,
    )
  },

  updateProject(token: string | null, projectId: string, name: string) {
    return request<{ project: ProjectSummary }>(
      `/dashboard/projects/${projectId}`,
      token,
      { method: 'PATCH', body: JSON.stringify({ name }) },
    )
  },

  listKeys(token: string | null, projectId: string) {
    return request<{ apiKeys: ApiKeyListItem[] }>(
      `/dashboard/projects/${projectId}/keys`,
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

  rotateKey(token: string | null, projectId: string, keyId: string) {
    return request<CreateKeyResult>(
      `/dashboard/projects/${projectId}/keys/${keyId}/rotate`,
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

  revokeKey(token: string | null, projectId: string, keyId: string) {
    return request<{ apiKey: ApiKeyListItem }>(
      `/dashboard/projects/${projectId}/keys/${keyId}/revoke`,
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

  listWebhookEndpoints(
    token: string | null,
    projectId: string,
    options: { mode?: Mode } = {},
  ) {
    const query = toQueryString({ mode: options.mode })
    return request<{ endpoints: WebhookEndpointSummary[] }>(
      `/dashboard/projects/${projectId}/webhooks${query}`,
      token,
    )
  },

  createWebhookEndpoint(
    token: string | null,
    projectId: string,
    input: { url: string; mode: Mode; eventTypes: WebhookEventType[] },
  ) {
    return request<CreateWebhookEndpointResult>(
      `/dashboard/projects/${projectId}/webhooks`,
      token,
      { method: 'POST', body: JSON.stringify(input) },
    )
  },

  deleteWebhookEndpoint(
    token: string | null,
    projectId: string,
    endpointId: string,
  ) {
    return request<{ endpoint: WebhookEndpointSummary }>(
      `/dashboard/projects/${projectId}/webhooks/${endpointId}`,
      token,
      { method: 'DELETE' },
    )
  },

  enableWebhookEndpoint(
    token: string | null,
    projectId: string,
    endpointId: string,
  ) {
    return request<{ endpoint: WebhookEndpointSummary }>(
      `/dashboard/projects/${projectId}/webhooks/${endpointId}/enable`,
      token,
      { method: 'POST' },
    )
  },

  disableWebhookEndpoint(
    token: string | null,
    projectId: string,
    endpointId: string,
  ) {
    return request<{ endpoint: WebhookEndpointSummary }>(
      `/dashboard/projects/${projectId}/webhooks/${endpointId}/disable`,
      token,
      { method: 'POST' },
    )
  },

  listWebhookDeliveries(
    token: string | null,
    projectId: string,
    endpointId: string,
    options: { limit?: number; cursor?: string } = {},
  ) {
    const query = toQueryString({
      limit: options.limit?.toString(),
      cursor: options.cursor,
    })
    return request<ListDeliveriesResult>(
      `/dashboard/projects/${projectId}/webhooks/${endpointId}/deliveries${query}`,
      token,
    )
  },

  redeliverWebhookDelivery(
    token: string | null,
    projectId: string,
    endpointId: string,
    deliveryId: string,
  ) {
    return request<{ delivery: WebhookDeliverySummary }>(
      `/dashboard/projects/${projectId}/webhooks/${endpointId}/deliveries/${deliveryId}/redeliver`,
      token,
      { method: 'POST' },
    )
  },

  listProjectEvents(
    token: string | null,
    projectId: string,
    options: { limit?: number; cursor?: string; mode?: Mode } = {},
  ) {
    const query = toQueryString({
      limit: options.limit?.toString(),
      cursor: options.cursor,
      mode: options.mode,
    })
    return request<ListProjectEventsResult>(
      `/dashboard/projects/${projectId}/events${query}`,
      token,
    )
  },
}
