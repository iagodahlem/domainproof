import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import type { ClerkAuthVariables } from "../accounts/clerk";
import { bootstrapAccount } from "../accounts/bootstrap";
import type { Database } from "../../infra/db/client";
import { projects } from "../../infra/db/schema";
import { apiError } from "../../shared/http-errors";
import { createKey, listKeys, revokeKey, rotateKey } from "./service";

const createKeyBodySchema = z.object({
  mode: z.enum(["test", "live"]),
  name: z.string().min(1).max(200).optional(),
});

function notFound() {
  return {
    body: apiError("not_found", "API key not found"),
    status: 404 as const,
  };
}

function invalidRequest(message: string) {
  return {
    body: apiError("invalid_request", message),
    status: 400 as const,
  };
}

/**
 * Resolves the caller's project. Every account currently has exactly one
 * ("Default") project — created atomically alongside the account in
 * {@link bootstrapAccount} — so this is a stand-in for real project
 * selection until the dashboard supports multiple projects per account.
 */
async function resolveProjectId(
  db: Database,
  clerkUserId: string,
): Promise<string> {
  const { accountId } = await bootstrapAccount(db, clerkUserId);

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.accountId, accountId))
    .limit(1);

  if (!project) {
    // Cannot happen: bootstrapAccount guarantees a default project exists
    // for every account (created atomically in the same transaction).
    throw new Error(`No project found for account ${accountId}`);
  }

  return project.id;
}

/**
 * Dashboard-facing key management routes, mounted under `/v1/keys`.
 * Every route is scoped to the caller's account -> project (resolved via
 * Clerk auth + {@link bootstrapAccount}): a `keyId` belonging to another
 * account's project always 404s, matching the anti-enumeration stance
 * used by the public-API key auth middleware — a caller should never be
 * able to distinguish "not yours" from "doesn't exist".
 */
export function createKeysRoutes(
  db: Database,
  clerkAuth: MiddlewareHandler<{ Variables: ClerkAuthVariables }>,
) {
  const router = new Hono<{ Variables: ClerkAuthVariables }>();

  router.use("*", clerkAuth);

  router.post("/", async (c) => {
    const json = await c.req.json().catch(() => undefined);
    const parsed = createKeyBodySchema.safeParse(json);

    if (!parsed.success) {
      const { body, status } = invalidRequest("Invalid request body");
      return c.json(body, status);
    }

    const projectId = await resolveProjectId(db, c.get("clerkUserId"));
    const result = await createKey(
      db,
      projectId,
      parsed.data.mode,
      parsed.data.name,
    );

    return c.json(result, 201);
  });

  router.get("/", async (c) => {
    const projectId = await resolveProjectId(db, c.get("clerkUserId"));
    const items = await listKeys(db, projectId);

    return c.json({ apiKeys: items });
  });

  router.post("/:keyId/revoke", async (c) => {
    const projectId = await resolveProjectId(db, c.get("clerkUserId"));
    const keyId = c.req.param("keyId");

    const revoked = await revokeKey(db, projectId, keyId);
    if (!revoked) {
      const { body, status } = notFound();
      return c.json(body, status);
    }

    return c.json({ apiKey: revoked });
  });

  router.post("/:keyId/rotate", async (c) => {
    const projectId = await resolveProjectId(db, c.get("clerkUserId"));
    const keyId = c.req.param("keyId");

    const result = await rotateKey(db, projectId, keyId);
    if (!result) {
      const { body, status } = notFound();
      return c.json(body, status);
    }

    return c.json(result);
  });

  return router;
}
