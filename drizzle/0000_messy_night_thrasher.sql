CREATE TYPE "public"."bet_leg_result" AS ENUM('pending', 'win', 'loss', 'push', 'void');--> statement-breakpoint
CREATE TYPE "public"."bet_slip_status" AS ENUM('open', 'won', 'lost', 'push', 'void');--> statement-breakpoint
CREATE TYPE "public"."bet_slip_type" AS ENUM('straight', 'parlay');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('scheduled', 'in_progress', 'final');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner_admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."top_up_status" AS ENUM('pending', 'paid', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_profile_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bet_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_slip_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"odds_quote_id" uuid,
	"selection_id" text NOT NULL,
	"selection_team" text NOT NULL,
	"selection_side" text NOT NULL,
	"spread" numeric(6, 2) NOT NULL,
	"american_odds" integer NOT NULL,
	"bookmaker_key" text NOT NULL,
	"quote_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"result" "bet_leg_result" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bet_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"slip_type" "bet_slip_type" NOT NULL,
	"stake_cents" integer NOT NULL,
	"potential_payout_cents" integer NOT NULL,
	"payout_cents" integer DEFAULT 0 NOT NULL,
	"status" "bet_slip_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"league_slug" text NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"commence_time" timestamp with time zone NOT NULL,
	"status" "game_status" DEFAULT 'scheduled' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_key" text NOT NULL,
	"week_key" text NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"bankroll_cents" integer NOT NULL,
	"roi_percent" integer NOT NULL,
	"win_streak" integer NOT NULL,
	"lock_points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sport_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lock_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"selection_id" text NOT NULL,
	"selection_team" text NOT NULL,
	"selection_side" text NOT NULL,
	"spread" numeric(6, 2) NOT NULL,
	"american_odds" integer NOT NULL,
	"bookmaker_key" text NOT NULL,
	"quote_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"week_key" text NOT NULL,
	"result" "bet_leg_result" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odds_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"bookmaker_key" text NOT NULL,
	"market" text DEFAULT 'spreads' NOT NULL,
	"selection_team" text NOT NULL,
	"selection_side" text NOT NULL,
	"point" numeric(6, 2) NOT NULL,
	"american_odds" integer NOT NULL,
	"quote_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "top_up_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "top_up_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"approved_by_user_profile_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"image_url" text,
	"role" "role" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"entry_type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"balance_after_cents" integer NOT NULL,
	"note" text NOT NULL,
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("actor_user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_bet_slip_id_bet_slips_id_fk" FOREIGN KEY ("bet_slip_id") REFERENCES "public"."bet_slips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_odds_quote_id_odds_quotes_id_fk" FOREIGN KEY ("odds_quote_id") REFERENCES "public"."odds_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_slips" ADD CONSTRAINT "bet_slips_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_league_slug_leagues_slug_fk" FOREIGN KEY ("league_slug") REFERENCES "public"."leagues"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lock_picks" ADD CONSTRAINT "lock_picks_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lock_picks" ADD CONSTRAINT "lock_picks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds_quotes" ADD CONSTRAINT "odds_quotes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_up_requests" ADD CONSTRAINT "top_up_requests_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_up_requests" ADD CONSTRAINT "top_up_requests_approved_by_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("approved_by_user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "games_external_id_idx" ON "games" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_clerk_user_id_idx" ON "user_profiles" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_email_idx" ON "user_profiles" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_accounts_user_profile_id_idx" ON "wallet_accounts" USING btree ("user_profile_id");