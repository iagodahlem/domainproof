import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    console.error(
      "Invalid environment configuration:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid environment configuration");
  }

  return parsed.data;
}

export const env = loadEnv();
