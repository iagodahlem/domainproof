import type { ClaimResult, DomainProofError, Verification } from './types'

/** Production Frontend API host — see the root README's "Environments" table. Override via `DomainProofProvider`'s `baseUrl` prop for local dev (e.g. `http://localhost:3001`, where every plane runs on one origin). */
export const DEFAULT_BASE_URL = 'https://frontend.api.domainproof.dev'

export type FetchResult<T> =
  { ok: true; data: T } | { ok: false; error: DomainProofError }

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<FetchResult<T>> {
  let response: Response
  try {
    response = await fetch(url, {
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
    const errorBody = (body as ApiErrorBody | null)?.error
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

/** `POST /frontend/component-sessions/:sessionToken/claim` — spends a single-use session to claim `domain`. */
export function claimComponentSession(
  baseUrl: string,
  sessionToken: string,
  domain: string,
): Promise<FetchResult<ClaimResult>> {
  return request<ClaimResult>(
    `${baseUrl}/frontend/component-sessions/${encodeURIComponent(sessionToken)}/claim`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain }),
    },
  )
}

/** `GET /frontend/verifications/:token` — reads a claim's current status without re-running the DNS check. */
export function fetchVerification(
  baseUrl: string,
  token: string,
): Promise<FetchResult<Verification>> {
  return request<Verification>(
    `${baseUrl}/frontend/verifications/${encodeURIComponent(token)}`,
  )
}

/** `POST /frontend/verifications/:token/check` — runs the DNS check and returns the (possibly updated) verification. Rate limited by the API: 1 per 15s, 20 per hour, per token. */
export function checkVerification(
  baseUrl: string,
  token: string,
): Promise<FetchResult<Verification>> {
  return request<Verification>(
    `${baseUrl}/frontend/verifications/${encodeURIComponent(token)}/check`,
    { method: 'POST' },
  )
}
