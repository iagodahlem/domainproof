import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { createSessionAuthMiddleware } from "@modules/accounts/session-auth";
import type { SessionVerifier } from "@modules/accounts/session-verifier";
import { createClerkSessionVerifier } from "@infra/auth/clerk";
import { createDb, type Database } from "@infra/db/client";
import { env } from "./env";
import { createKeysRoutes } from "@modules/keys/routes";
import { apiError } from "@shared/http-errors";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PackageJson {
  version: string;
}

const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
) as PackageJson;

export interface AppDependencies {
  /** Injected for tests; defaults to a client built from `env.DATABASE_URL`. */
  db?: Database;
  /**
   * Injected for tests; defaults to a Clerk-backed verifier built from
   * `env.CLERK_JWKS_URL` / `env.CLERK_ISSUER`, or `undefined` (session auth
   * routes 500 with `auth_not_configured`) if those aren't set.
   */
  sessionVerifier?: SessionVerifier;
}

export function createApp(deps: AppDependencies = {}) {
  const app = new Hono();
  const db = deps.db ?? createDb(env.DATABASE_URL);
  const sessionVerifier =
    deps.sessionVerifier ??
    (env.CLERK_JWKS_URL && env.CLERK_ISSUER
      ? createClerkSessionVerifier({
          jwksUrl: env.CLERK_JWKS_URL,
          issuer: env.CLERK_ISSUER,
        })
      : undefined);
  const sessionAuth = createSessionAuthMiddleware(sessionVerifier);

  app.get("/health", (c) => {
    return c.json({ status: "ok", version: pkg.version });
  });

  // /dashboard/* is the session-authenticated backend of the dashboard app
  // (unversioned — we control its only consumer). /v1/* is reserved for
  // the public, API-key-authenticated plane; see ARCHITECTURE.md.
  app.route("/dashboard/keys", createKeysRoutes(db, sessionAuth));

  app.notFound((c) => {
    return c.json(apiError("not_found", "Route not found"), 404);
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json(apiError("internal_error", "Internal server error"), 500);
  });

  return app;
}

export const app = createApp();
