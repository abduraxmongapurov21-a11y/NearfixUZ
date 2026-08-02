ALTER TABLE "users"
ADD COLUMN "display_name" TEXT,
ADD COLUMN "username" TEXT,
ADD COLUMN "avatar_url" TEXT;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_display_name_search_idx" ON "users" (LOWER("display_name") text_pattern_ops);
CREATE INDEX "users_username_search_idx" ON "users" (LOWER("username") text_pattern_ops);
