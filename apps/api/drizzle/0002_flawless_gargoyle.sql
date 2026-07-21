ALTER TABLE "domains" ADD COLUMN "next_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "check_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "grace_expires_at" timestamp with time zone;