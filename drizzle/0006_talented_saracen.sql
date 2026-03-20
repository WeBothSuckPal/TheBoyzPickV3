CREATE INDEX "bet_slips_status_idx" ON "bet_slips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lock_picks_week_key_idx" ON "lock_picks" USING btree ("week_key");