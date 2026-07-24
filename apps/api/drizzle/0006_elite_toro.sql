-- All rows in "projects" today are disposable test/demo data (verified
-- before this migration ran against any real environment) — safe to
-- deterministically rewrite any duplicate slug rather than blocking the
-- unique constraint below. For each duplicate group (same "slug"), the
-- oldest row keeps its slug; every later row gets a random 6-character
-- lowercase-hex suffix appended, truncating first so the result still fits
-- the brand slug format's 32-character cap (see modules/projects/domain/
-- brand.ts's BRAND_SLUG_PATTERN/MAX_BRAND_SLUG_LENGTH) and stripping a
-- trailing hyphen truncation could expose.
WITH "ranked" AS (
	SELECT "id", "slug",
		row_number() OVER (PARTITION BY "slug" ORDER BY "created_at", "id") AS "rn"
	FROM "projects"
)
UPDATE "projects"
SET "slug" = regexp_replace(left("ranked"."slug", 25), '-+$', '')
	|| '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)
FROM "ranked"
WHERE "projects"."id" = "ranked"."id" AND "ranked"."rn" > 1;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_slug_unique" UNIQUE("slug");
