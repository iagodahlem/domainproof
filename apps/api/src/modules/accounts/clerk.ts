import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { MiddlewareHandler } from "hono";
import { apiError } from "../../shared/http-errors";

/**
 * Hono context variable holding the verified Clerk user id, available to
 * any handler downstream of {@link createClerkAuthMiddleware}.
 */
export interface ClerkAuthVariables {
  clerkUserId: string;
}

export interface ClerkAuthConfig {
  /** JWKS endpoint for the Clerk instance, e.g. env `CLERK_JWKS_URL`. */
  jwksUrl?: string;
  /** Expected `iss` claim, e.g. env `CLERK_ISSUER`. */
  issuer?: string;
}

function unauthorized(message: string) {
  return {
    body: apiError("unauthorized", message),
    status: 401 as const,
  };
}

/**
 * Verifies a Clerk-issued JWT from the `Authorization: Bearer` header and
 * sets the verified user id on the request context.
 *
 * Both `jwksUrl` and `issuer` are optional at the env level so the app can
 * boot before Clerk is wired up everywhere; a route mounting this
 * middleware without both configured gets a 500 with a clear error code
 * rather than silently accepting every request.
 */
export function createClerkAuthMiddleware(
  config: ClerkAuthConfig,
): MiddlewareHandler<{ Variables: ClerkAuthVariables }> {
  const jwks =
    config.jwksUrl && config.issuer
      ? createRemoteJWKSet(new URL(config.jwksUrl))
      : undefined;

  return async (c, next) => {
    if (!jwks || !config.issuer) {
      return c.json(
        apiError(
          "auth_not_configured",
          "Clerk authentication is not configured (missing CLERK_JWKS_URL or CLERK_ISSUER)",
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

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, jwks, { issuer: config.issuer }));
    } catch {
      const { body, status } = unauthorized("Invalid or expired token");
      return c.json(body, status);
    }

    if (!payload.sub) {
      const { body, status } = unauthorized("Token is missing a subject claim");
      return c.json(body, status);
    }

    c.set("clerkUserId", payload.sub);
    await next();
  };
}
