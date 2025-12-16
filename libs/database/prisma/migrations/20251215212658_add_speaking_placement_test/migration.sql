-- CreateTable: SpeakingPlacementTest for assessing user's initial pronunciation level
CREATE TABLE "speaking_placement_tests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "overallLevel" INTEGER DEFAULT 1,
    "phonemeAssessment" JSONB,
    "topicRecommendations" JSONB,
    "testItems" JSONB,
    "responses" JSONB,
    "totalScore" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaking_placement_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint for userId (one test per user)
CREATE UNIQUE INDEX "speaking_placement_tests_userId_key" ON "speaking_placement_tests"("userId");

-- CreateIndex: Index for queries
CREATE INDEX "speaking_placement_tests_userId_idx" ON "speaking_placement_tests"("userId");
CREATE INDEX "speaking_placement_tests_status_idx" ON "speaking_placement_tests"("status");

-- AddForeignKey: Link SpeakingPlacementTest to User
ALTER TABLE "speaking_placement_tests" ADD CONSTRAINT "speaking_placement_tests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
