CREATE INDEX "sessions_token_hash_active_idx" ON "sessions" ("token_hash") WHERE "revoked_at" IS NULL;
