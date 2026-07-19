import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { createClerkAuthMiddleware, type ClerkAuthConfig } from "./modules/accounts/clerk";
import { createDb, type Database } from "./infra/db/client";
import { env } from "./env";
import { createKeysRoutes } from "./modules/keys/routes";
import { apiError } from "./shared/http-errors";

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
  /** Injected for tests; defaults to `env.CLERK_JWKS_URL` / `env.CLERK_ISSUER`. */
  clerkConfig?: ClerkAuthConfig;
}

export function createApp(deps: AppDependencies = {}) {
  const app = new Hono();
  const db = deps.db ?? createDb(env.DATABASE_URL);
  const clerkConfig = deps.clerkConfig ?? {
    jwksUrl: env.CLERK_JWKS_URL,
    issuer: env.CLERK_ISSUER,
  };
  const clerkAuth = createClerkAuthMiddleware(clerkConfig);

  app.get("/health", (c) => {
    return c.json({ status: "ok", version: pkg.version });
  });

  app.route("/v1/keys", createKeysRoutes(db, clerkAuth));

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
