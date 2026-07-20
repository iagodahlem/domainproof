-- Add the project brand slug column. A DEFAULT is set only long enough to
-- backfill any existing rows (there are none in prod today, but the
-- migration has to be sound regardless) with the same 'app' fallback
-- `deriveProjectSlug` uses in application code; it's then dropped so every
-- future insert has to supply a slug explicitly, matching how the app
-- always derives one at project-creation time.
ALTER TABLE "projects" ADD COLUMN "slug" text DEFAULT 'app' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "slug" DROP DEFAULT;
