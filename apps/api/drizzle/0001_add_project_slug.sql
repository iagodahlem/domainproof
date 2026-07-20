-- Add the project brand slug column. Existing rows (there are none in prod
-- today, but the migration has to be sound regardless) get a best-effort
-- slug derived from their name in SQL: lowercase, fold whitespace/
-- underscores to hyphens, strip everything outside [a-z0-9-], collapse
-- repeated hyphens, trim leading/trailing hyphens, cap at 32 characters,
-- falling back to 'app' when nothing valid survives (an empty or all-symbol
-- name). This approximates `deriveProjectSlug`
-- (apps/api/src/modules/projects/domain/brand.ts) — the rule application
-- code uses at project-creation time — closely enough to be honest about
-- what a migrated row's slug means, though it isn't a byte-for-byte port:
-- it doesn't re-check the reserved-slug list, since with zero rows to
-- migrate today that's a documentation nicety, not a correctness risk.
ALTER TABLE "projects" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "projects" SET "slug" = (
  CASE
    WHEN length(rtrim(left(trim(both '-' from regexp_replace(regexp_replace(regexp_replace(lower(trim("name")), '[\s_]+', '-', 'g'), '[^a-z0-9-]', '', 'g'), '-{2,}', '-', 'g')), 32), '-')) < 2
      THEN 'app'
    ELSE rtrim(left(trim(both '-' from regexp_replace(regexp_replace(regexp_replace(lower(trim("name")), '[\s_]+', '-', 'g'), '[^a-z0-9-]', '', 'g'), '-{2,}', '-', 'g')), 32), '-')
  END
);--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL;
