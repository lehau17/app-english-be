-- AlterTable
ALTER TABLE "public"."AgentConversation" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'student';

-- CreateIndex
CREATE INDEX "AgentConversation_role_idx" ON "public"."AgentConversation"("role");

-- CreateIndex
CREATE INDEX "AgentConversation_userId_role_idx" ON "public"."AgentConversation"("userId", "role");
