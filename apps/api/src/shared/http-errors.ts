/**
 * Every non-2xx response from this api follows `{ error: { code, message } }`
 * (see the repo's architecture rules). This is the one place that shape is
 * defined, so every module builds its error responses from the same
 * taxonomy instead of each route/middleware inventing its own JSON shape.
 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

/** Builds an `{ error: { code, message } }` body for a Hono `c.json(...)` response. */
export function apiError(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}
