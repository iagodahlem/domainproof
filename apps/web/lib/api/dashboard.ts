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

  rotateKey(token: string | null, projectId: string, keyId: string) {
    return request<CreateKeyResult>(
      `/dashboard/projects/${projectId}/keys/${keyId}/rotate`,
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

  listWebhookEndpoints(token: string | null, projectId: string) {
    return request<{ endpoints: WebhookEndpointSummary[] }>(
      `/dashboard/projects/${projectId}/webhooks`,
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
    options: { limit?: number; cursor?: string } = {},
  ) {
    const query = toQueryString({
      limit: options.limit?.toString(),
      cursor: options.cursor,
    })
    return request<ListProjectEventsResult>(
      `/dashboard/projects/${projectId}/events${query}`,
      token,
    )
  },
}
