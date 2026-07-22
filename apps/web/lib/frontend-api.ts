import type { DomainStatus, Provider } from '@domainproof/core'

/**
 * Default target for local dev, where the api runs unrestricted on one
 * origin (see README.md's "Environments" table) — production sets
 * `NEXT_PUBLIC_FRONTEND_API_URL` to `https://frontend.api.domainproof.dev`.
 * `NEXT_PUBLIC_` so the value reaches the browser bundle: the hosted
 * verification page's polling and recheck calls run client-side, straight
 * against this plane (it answers CORS from any origin — see
 * `apis/frontend/router.ts`), not through a Next.js route handler proxy.
 */
const DEFAULT_FRONTEND_API_URL = 'http://localhost:3001'

export function frontendApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_FRONTEND_API_URL ?? DEFAULT_FRONTEND_API_URL
}

export interface VerificationRecord {
  label: string
  type: string
  value: string
}

export interface VerificationCheck {
  outcome: string
  checkedAt: string
  expected?: string
  detected?: string[]
}

export interface Verification {
  domain: string
  mode: 'test' | 'live'
  status: DomainStatus
  projectName: string
  provider: Provider
  records: VerificationRecord[]
  check: VerificationCheck | null
  updatedAt: string
}

export interface VerificationEvent {
  id: string
  type: string
  mode: 'test' | 'live' | null
  createdAt: string
  outcome?: string
}

export interface ListEventsResult {
  events: VerificationEvent[]
  nextCursor: string | null
}

/**
 * Mirrors the api's `{ error: { code, message } }` taxonomy (see
 * `shared/http-errors.ts`), plus a `network` kind for a `fetch` that never
 * got an HTTP response at all (connection refused, DNS failure, offline) —
 * the two need different handling: a `404 not_found` means the token
 * itself is invalid, a network failure means "try again," never the same
 * UI as an empty/absent result (Clerk lesson: fetch errors render as
 * errors, not empty states).
 */
export type FrontendApiError =
  | { kind: 'http'; status: number; code: string; message: string }
  | { kind: 'network'; message: string }

export type FrontendApiResult<T> =
  { ok: true; data: T } | { ok: false; error: FrontendApiError }

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<FrontendApiResult<T>> {
  let response: Response
  try {
    response = await fetch(`${frontendApiBaseUrl()}${path}`, {
      ...init,
      headers: { accept: 'application/json', ...init?.headers },
    })
  } catch (cause) {
    return {
      ok: false,
      error: {
        kind: 'network',
        message: cause instanceof Error ? cause.message : 'Network error',
      },
    }
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorBody =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error: { code: string; message: string } }).error
        : undefined
    return {
      ok: false,
      error: {
        kind: 'http',
        status: response.status,
        code: errorBody?.code ?? 'unknown_error',
        message: errorBody?.message ?? response.statusText,
      },
    }
  }

  return { ok: true, data: body as T }
}

export function getVerification(
  token: string,
): Promise<FrontendApiResult<Verification>> {
  return request<Verification>(`/frontend/verifications/${token}`)
}

export function runVerificationCheck(
  token: string,
): Promise<FrontendApiResult<Verification>> {
  return request<Verification>(`/frontend/verifications/${token}/check`, {
    method: 'POST',
  })
}

export function listVerificationEvents(
  token: string,
  params: { limit?: number; cursor?: string } = {},
): Promise<FrontendApiResult<ListEventsResult>> {
  const query = new URLSearchParams()
  if (params.limit) query.set('limit', String(params.limit))
  if (params.cursor) query.set('cursor', params.cursor)
  const suffix = query.size > 0 ? `?${query}` : ''
  return request<ListEventsResult>(
    `/frontend/verifications/${token}/events${suffix}`,
  )
}

export function cloudflareAuthorizeUrl(token: string): string {
  return `${frontendApiBaseUrl()}/frontend/verifications/${token}/cloudflare/authorize`
}
