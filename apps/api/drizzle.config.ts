import { defineConfig } from "drizzle-kit";

// drizzle-kit loads a local .env automatically, so DATABASE_URL is picked
// up from apps/api/.env in dev. The fallback matches the postgres service
// in the repo's compose.yaml for a zero-config local run.
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://domainproof:domainproof@localhost:5432/domainproof";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
