CREATE TABLE "component_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"mode" "mode" NOT NULL,
	"external_id" text,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "component_sessions" ADD CONSTRAINT "component_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;