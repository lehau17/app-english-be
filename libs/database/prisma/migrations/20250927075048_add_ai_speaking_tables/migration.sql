-- CreateEnum
CREATE TYPE "public"."AiSpeakingSessionState" AS ENUM ('pending', 'ai_speaking', 'user_speaking', 'evaluating', 'finished', 'aborted');

-- CreateEnum
CREATE TYPE "public"."AiSpeakingTurnStatus" AS ENUM ('pending', 'streaming', 'waiting_user', 'evaluating', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."AiSpeakingTurnRole" AS ENUM ('system', 'ai', 'user');

-- CreateTable
CREATE TABLE "public"."ai_speaking_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT,
    "goal" TEXT,
    "state" "public"."AiSpeakingSessionState" NOT NULL DEFAULT 'pending',
    "maxTurns" INTEGER NOT NULL DEFAULT 8,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "targetDifficulty" "public"."DifficultyLevel" NOT NULL DEFAULT 'beginner',
    "currentDifficulty" "public"."DifficultyLevel",
    "silenceWarnings" INTEGER NOT NULL DEFAULT 0,
    "offTopicWarnings" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "metadata" JSONB,
    "analytics" JSONB,
    "summary" TEXT,
    "summaryPayload" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_speaking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_speaking_turns" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "state" "public"."AiSpeakingTurnStatus" NOT NULL DEFAULT 'pending',
    "aiPrompt" TEXT,
    "aiAudioUrl" TEXT,
    "userTranscript" TEXT,
    "userAudioUrl" TEXT,
    "userDurationSec" INTEGER,
    "metrics" JSONB,
    "evaluation" JSONB,
    "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "score" INTEGER,
    "relevanceScore" DOUBLE PRECISION,
    "silenceDetected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_speaking_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_speaking_turn_segments" (
    "id" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "role" "public"."AiSpeakingTurnRole" NOT NULL,
    "orderNo" INTEGER NOT NULL DEFAULT 0,
    "transcript" TEXT,
    "audioUrl" TEXT,
    "durationSec" INTEGER,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_speaking_turn_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_speaking_sessions_userId_createdAt_idx" ON "public"."ai_speaking_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_speaking_sessions_state_lastActivityAt_idx" ON "public"."ai_speaking_sessions"("state", "lastActivityAt");

-- CreateIndex
CREATE INDEX "ai_speaking_turns_sessionId_idx" ON "public"."ai_speaking_turns"("sessionId");

-- CreateIndex
CREATE INDEX "ai_speaking_turns_state_createdAt_idx" ON "public"."ai_speaking_turns"("state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_speaking_turns_sessionId_turnIndex_key" ON "public"."ai_speaking_turns"("sessionId", "turnIndex");

-- CreateIndex
CREATE INDEX "ai_speaking_turn_segments_turnId_orderNo_idx" ON "public"."ai_speaking_turn_segments"("turnId", "orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "ai_speaking_turn_segments_turnId_role_orderNo_key" ON "public"."ai_speaking_turn_segments"("turnId", "role", "orderNo");

-- AddForeignKey
ALTER TABLE "public"."ai_speaking_sessions" ADD CONSTRAINT "ai_speaking_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_speaking_turns" ADD CONSTRAINT "ai_speaking_turns_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ai_speaking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_speaking_turn_segments" ADD CONSTRAINT "ai_speaking_turn_segments_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "public"."ai_speaking_turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
