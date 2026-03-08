CREATE TABLE "ai_market_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"league_slug" text NOT NULL,
	"bookmaker_key" text NOT NULL,
	"selection_side" text NOT NULL,
	"spread" numeric(6, 2) NOT NULL,
	"american_odds" integer NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anomaly_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ops_health_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" text NOT NULL,
	"score" integer NOT NULL,
	"summary" text NOT NULL,
	"findings" jsonb NOT NULL,
	"remediations" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_market_snapshots" ADD CONSTRAINT "ai_market_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_market_snapshots" ADD CONSTRAINT "ai_market_snapshots_league_slug_leagues_slug_fk" FOREIGN KEY ("league_slug") REFERENCES "public"."leagues"("slug") ON DELETE no action ON UPDATE no action;