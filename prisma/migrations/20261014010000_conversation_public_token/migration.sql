ALTER TABLE "Conversation" ADD COLUMN "publicToken" TEXT;
UPDATE "Conversation" SET "publicToken" = lower(hex(randomblob(16))) WHERE "publicToken" IS NULL;
CREATE UNIQUE INDEX "Conversation_publicToken_key" ON "Conversation"("publicToken");
