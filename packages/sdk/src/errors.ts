import type { components } from './generated/openapi-types'

type ApiErrorBody = components['schemas']['ApiError']

/**
 * The API's `{ error: { code, message } }` taxonomy, surfaced as an Error
 * subclass — never thrown by the SDK itself (see `Result<T>` in
 * `client.ts`), just used as the `error` half of a `Result`. `.code` lets
 * callers branch on the taxonomy (`invalid_api_key`, `not_found`,
 * `domain_already_claimed`, ...) without parsing `.message`.
 *
 * `code: 'network_error'` and `status: 0` mean the request never reached
 * the API (DNS failure, connection refused, ...) — every other instance
 * carries the HTTP status the API actually responded with.
 */
export class DomainProofApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'DomainProofApiError'
    this.code = code
    this.status = status
  }
}

/** Builds a {@link DomainProofApiError} from a parsed (or unparseable) response body. */
export function parseApiError(
  body: unknown,
  fallbackMessage: string,
  status: number,
): DomainProofApiError {
  const parsed = body as Partial<ApiErrorBody> | null
  return new DomainProofApiError(
    parsed?.error?.code ?? 'unknown_error',
    parsed?.error?.message ?? fallbackMessage,
    status,
  )
}
