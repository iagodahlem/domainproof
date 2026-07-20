import { Hono } from "hono";
import { z } from "zod";
import type { SessionAuthVariables } from "../middlewares/session-auth";
import type { ProjectsService } from "@modules/projects/service";
import type { KeysService } from "@modules/keys/service";
import { apiError } from "@shared/http-errors";

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
 * Dashboard-facing key management routes, mounted at `/keys` under the
 * dashboard plane's router (giving `/dashboard/keys`). Every route is
 * scoped to the caller's account -> project (resolved via
 * `projectsService.getDefaultProjectId`): a `keyId` belonging to another
 * account's project always 404s, matching the anti-enumeration stance
 * used by the public-API key auth middleware — a caller should never be
 * able to distinguish "not yours" from "doesn't exist".
 *
 * Session auth is applied once for the whole plane in
 * `apis/dashboard/router.ts`, not here — by the time a handler in this
 * file runs, `c.get("userId")` is already set. Parses/validates input,
 * calls the injected services, and maps the result to HTTP — no db or
 * schema access here; that's `keysService` and `projectsService`'s job
 * (each backed by its own module's repository).
 */
export function createKeysRoutes(keysService: KeysService, projectsService: ProjectsService) {
  const router = new Hono<{ Variables: SessionAuthVariables }>();

  router.post("/", async (c) => {
    const json = await c.req.json().catch(() => undefined);
    const parsed = createKeyBodySchema.safeParse(json);

    if (!parsed.success) {
      const { body, status } = invalidRequest("Invalid request body");
      return c.json(body, status);
    }

    const projectId = await projectsService.getDefaultProjectId(c.get("userId"));
    const result = await keysService.createKey(
      projectId,
      parsed.data.mode,
      parsed.data.name,
    );

    return c.json(result, 201);
  });

  router.get("/", async (c) => {
    const projectId = await projectsService.getDefaultProjectId(c.get("userId"));
    const items = await keysService.listKeys(projectId);

    return c.json({ apiKeys: items });
  });

  router.post("/:keyId/revoke", async (c) => {
    const projectId = await projectsService.getDefaultProjectId(c.get("userId"));
    const keyId = c.req.param("keyId");

    const revoked = await keysService.revokeKey(projectId, keyId);
    if (!revoked) {
      const { body, status } = notFound();
      return c.json(body, status);
    }

    return c.json({ apiKey: revoked });
  });

  router.post("/:keyId/rotate", async (c) => {
    const projectId = await projectsService.getDefaultProjectId(c.get("userId"));
    const keyId = c.req.param("keyId");

    const result = await keysService.rotateKey(projectId, keyId);
    if (!result) {
      const { body, status } = notFound();
      return c.json(body, status);
    }

    return c.json(result);
  });

  return router;
}
