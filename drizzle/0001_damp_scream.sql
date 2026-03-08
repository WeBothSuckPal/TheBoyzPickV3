CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"subject_key" text NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD COLUMN "actor_email" text;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD COLUMN "outcome" text DEFAULT 'success' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_buckets_category_subject_idx" ON "rate_limit_buckets" USING btree ("category","subject_key");--> statement-breakpoint
CREATE UNIQUE INDEX "lock_picks_user_week_idx" ON "lock_picks" USING btree ("user_profile_id","week_key");--> statement-breakpoint
CREATE UNIQUE INDEX "odds_quotes_primary_identity_idx" ON "odds_quotes" USING btree ("game_id","bookmaker_key","market","selection_side","is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_entries_entry_reference_idx" ON "wallet_ledger_entries" USING btree ("entry_type","reference_id") WHERE "wallet_ledger_entries"."reference_id" is not null;