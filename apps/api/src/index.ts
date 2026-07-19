import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./env";

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on port ${info.port}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down`);

  server.close((err) => {
    if (err) {
      console.error("Error during shutdown", err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
