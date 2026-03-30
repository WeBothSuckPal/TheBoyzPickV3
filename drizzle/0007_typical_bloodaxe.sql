ALTER TABLE "odds_quotes" ADD COLUMN IF NOT EXISTS "opening_point" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "odds_quotes" ADD COLUMN IF NOT EXISTS "opening_american_odds" integer;
