CREATE TYPE "ConversationType" AS ENUM ('DIRECT');

CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
    "direct_user_one_id" TEXT NOT NULL,
    "direct_user_two_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversations_direct_users_order_check" CHECK ("direct_user_one_id" < "direct_user_two_id")
);

CREATE TABLE "conversation_members" (
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id", "user_id")
);

CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "client_message_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversations_direct_user_one_id_direct_user_two_id_key"
ON "conversations"("direct_user_one_id", "direct_user_two_id");
CREATE INDEX "conversations_updated_at_idx" ON "conversations"("updated_at");
CREATE INDEX "conversation_members_user_id_idx" ON "conversation_members"("user_id");
CREATE UNIQUE INDEX "messages_conversation_id_sender_id_client_message_id_key"
ON "messages"("conversation_id", "sender_id", "client_message_id");
CREATE INDEX "messages_conversation_id_created_at_id_idx"
ON "messages"("conversation_id", "created_at", "id");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_direct_user_one_id_fkey"
FOREIGN KEY ("direct_user_one_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_direct_user_two_id_fkey"
FOREIGN KEY ("direct_user_two_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
