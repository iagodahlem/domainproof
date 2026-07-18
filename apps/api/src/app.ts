import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PackageJson {
  version: string;
}

const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
) as PackageJson;

export function createApp() {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ status: "ok", version: pkg.version });
  });

  app.notFound((c) => {
    return c.json(
      { error: { code: "not_found", message: "Route not found" } },
      404,
    );
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json(
      { error: { code: "internal_error", message: "Internal server error" } },
      500,
    );
  });

  return app;
}

export const app = createApp();
