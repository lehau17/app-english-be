-- Rebuild conversation and messaging stack
DROP TABLE IF EXISTS "ConversationParticipant";
DROP TABLE IF EXISTS "Message";
DROP TABLE IF EXISTS "Conversation";

CREATE TYPE "public"."ConversationType" AS ENUM ('class', 'personal');
CREATE TYPE "public"."MessageType" AS ENUM ('text', 'image', 'file', 'system');

CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "type" "public"."ConversationType" NOT NULL DEFAULT 'class',
    "name" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "lastMessageSenderId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "public"."MessageType" NOT NULL DEFAULT 'text',
    "metadata" JSONB,
    "attachments" JSONB,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Conversation_classroomId_idx" ON "public"."Conversation"("classroomId");
CREATE INDEX "Conversation_classroomId_type_idx" ON "public"."Conversation"("classroomId", "type");
CREATE INDEX "Conversation_type_idx" ON "public"."Conversation"("type");
CREATE UNIQUE INDEX "Conversation_scopeKey_key" ON "public"."Conversation"("scopeKey");

CREATE INDEX "ConversationParticipant_conversationId_idx" ON "public"."ConversationParticipant"("conversationId");
CREATE INDEX "ConversationParticipant_userId_idx" ON "public"."ConversationParticipant"("userId");
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "public"."ConversationParticipant"("conversationId", "userId");

CREATE INDEX "Message_conversationId_createdAt_idx" ON "public"."Message"("conversationId", "createdAt");
CREATE INDEX "Message_senderId_idx" ON "public"."Message"("senderId");

ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_lastMessageSenderId_fkey" FOREIGN KEY ("lastMessageSenderId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
