-- CreateEnum
CREATE TYPE "public"."LeaderboardScope" AS ENUM ('classroom', 'monthly', 'yearly');

-- CreateTable
CREATE TABLE "public"."leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "scope" "public"."LeaderboardScope" NOT NULL,
    "classroomId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "userId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "payload" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshot_unique" ON "public"."leaderboard_snapshots"("scope", "classroomId", "year", "month", "userId");

-- CreateIndex
CREATE INDEX "leaderboard_snapshot_scope_idx" ON "public"."leaderboard_snapshots"("scope", "classroomId", "year", "month");

-- CreateIndex
CREATE INDEX "leaderboard_snapshot_score_idx" ON "public"."leaderboard_snapshots"("scope", "year", "month", "totalScore");

-- AddForeignKey
ALTER TABLE "public"."leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
