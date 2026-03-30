ALTER TABLE "top_up_requests" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "top_up_requests_user_idempotency_idx" ON "top_up_requests" USING btree ("user_profile_id","idempotency_key") WHERE "top_up_requests"."idempotency_key" is not null;
