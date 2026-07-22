/**
 * Bare fetch wrapper shared by every API plane this app talks to: base URL,
 * bearer-token attach, and `{ error: { code, message } }` envelope parsing
 * (see the repo's architecture rules) — this is the one place that shape is
 * parsed, so callers never see raw fetch/JSON plumbing. Plane-specific call
 * shapes (e.g. the dashboard plane's `dashboardApi`) live in their own
 * modules and import `request` from here.
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

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured')
  }
  return url
}

export async function request<T>(
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
