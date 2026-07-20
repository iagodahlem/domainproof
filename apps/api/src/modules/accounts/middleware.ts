import type { MiddlewareHandler } from "hono";
import { apiError } from "@shared/http-errors";
import type { SessionVerifier, SessionVerifyResult } from "./ports";

/**
 * Hono context variable holding the verified session's user id, available
 * to any handler downstream of {@link createSessionAuthMiddleware}.
 */
export interface SessionAuthVariables {
  userId: string;
}

function unauthorized(message: string) {
  return {
    body: apiError("unauthorized", message),
    status: 401 as const,
  };
}

function messageForFailure(reason: Extract<SessionVerifyResult, { ok: false }>["reason"]): string {
  switch (reason) {
    case "invalid_or_expired":
      return "Invalid or expired token";
    case "missing_subject":
      return "Token is missing a subject claim";
  }
}

/**
 * Verifies a bearer token from the `Authorization` header against an
 * injected {@link SessionVerifier} and sets the resulting user id on the
 * request context. Reads the header and maps the verifier's result to an
 * HTTP response — it never itself knows how a token is verified (that's
 * the port's job, implemented by a concrete adapter in `infra/auth/`).
 *
 * `verifier` is optional so the app can boot before session auth is wired
 * up everywhere; a route mounting this middleware without one configured
 * gets a 500 with a clear error code rather than silently accepting every
 * request.
 */
export function createSessionAuthMiddleware(
  verifier: SessionVerifier | undefined,
): MiddlewareHandler<{ Variables: SessionAuthVariables }> {
  return async (c, next) => {
    if (!verifier) {
      return c.json(
        apiError(
          "auth_not_configured",
          "Session authentication is not configured",
        ),
        500,
      );
    }

    const header = c.req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
      const { body, status } = unauthorized(
        "Missing or malformed Authorization header",
      );
      return c.json(body, status);
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      const { body, status } = unauthorized(
        "Missing or malformed Authorization header",
      );
      return c.json(body, status);
    }

    const result = await verifier.verify(token);
    if (!result.ok) {
      const { body, status } = unauthorized(messageForFailure(result.reason));
      return c.json(body, status);
    }

    c.set("userId", result.claims.userId);
    await next();
  };
}
