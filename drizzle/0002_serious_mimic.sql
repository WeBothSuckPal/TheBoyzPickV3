ALTER TYPE "public"."game_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."game_status" ADD VALUE 'postponed';--> statement-breakpoint
CREATE TABLE "admin_audit_log_archives" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_profile_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"request_id" text,
	"ip_hash" text,
	"outcome" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log_archives" ADD CONSTRAINT "admin_audit_log_archives_actor_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("actor_user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;