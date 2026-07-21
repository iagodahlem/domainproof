ALTER TABLE "domains" ADD COLUMN "frontend_token" text;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "last_check_result" jsonb;--> statement-breakpoint
UPDATE "domains" SET "frontend_token" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') WHERE "frontend_token" IS NULL;--> statement-breakpoint
ALTER TABLE "domains" ALTER COLUMN "frontend_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_frontend_token_unique" UNIQUE("frontend_token");