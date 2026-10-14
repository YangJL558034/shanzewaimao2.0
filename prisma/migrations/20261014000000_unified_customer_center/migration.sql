CREATE TABLE "CustomerContact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fullName" TEXT,
  "companyName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "country" TEXT,
  "source" TEXT NOT NULL DEFAULT 'website',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CustomerContact_email_key" ON "CustomerContact"("email");
CREATE UNIQUE INDEX "CustomerContact_phone_key" ON "CustomerContact"("phone");
CREATE INDEX "CustomerContact_companyName_idx" ON "CustomerContact"("companyName");
CREATE INDEX "CustomerContact_createdAt_idx" ON "CustomerContact"("createdAt");

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contactId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "externalId" TEXT,
  "subject" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "sourceUrl" TEXT,
  "assignedToId" TEXT,
  "inquiryId" TEXT,
  "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CustomerContact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Conversation_channel_externalId_key" ON "Conversation"("channel", "externalId");
CREATE INDEX "Conversation_status_lastMessageAt_idx" ON "Conversation"("status", "lastMessageAt");
CREATE INDEX "Conversation_assignedToId_status_idx" ON "Conversation"("assignedToId", "status");
CREATE INDEX "Conversation_contactId_lastMessageAt_idx" ON "Conversation"("contactId", "lastMessageAt");

CREATE TABLE "ConversationMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "externalId" TEXT,
  "authorId" TEXT,
  "metadataJson" TEXT,
  "deliveredAt" DATETIME,
  "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ConversationMessage_conversationId_externalId_key" ON "ConversationMessage"("conversationId", "externalId");
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");
