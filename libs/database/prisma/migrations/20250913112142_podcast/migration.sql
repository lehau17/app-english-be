-- CreateEnum
CREATE TYPE "public"."PodcastStatus" AS ENUM ('draft', 'published', 'archived', 'scheduled');

-- CreateEnum
CREATE TYPE "public"."PodcastCategory" AS ENUM ('Du học', 'Kinh doanh', 'Công nghệ', 'Lối sống', 'Giải trí', 'Giáo dục', 'Tin tức', 'Văn hóa', 'Khoa học', 'Du lịch');

-- CreateEnum
CREATE TYPE "public"."PodcastSource" AS ENUM ('WELE Partners', 'TED Talks', 'BBC', 'CNN', 'Voice of America', 'British Council', 'Nội bộ');

-- CreateEnum
CREATE TYPE "public"."PodcastDifficulty" AS ENUM ('Người mới bắt đầu', 'Sơ cấp', 'Trung cấp', 'Trung cấp cao', 'Nâng cao');

-- CreateEnum
CREATE TYPE "public"."ListeningActivityType" AS ENUM ('Quiz nhanh', 'Chính tả', 'Hiểu nghĩa', 'Phát âm', 'Từ vựng', 'Nói với AI', 'Luyện viết', 'Tóm tắt');

-- CreateTable
CREATE TABLE "public"."podcasts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "storyTitle" TEXT,
    "storyContent" TEXT,
    "audioUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "transcriptUrl" TEXT,
    "category" "public"."PodcastCategory" NOT NULL,
    "source" "public"."PodcastSource" NOT NULL,
    "difficulty" "public"."PodcastDifficulty" NOT NULL DEFAULT 'Trung cấp',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duration" INTEGER NOT NULL,
    "durationFormatted" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."PodcastStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "slug" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasTranscript" BOOLEAN NOT NULL DEFAULT false,
    "hasActivities" BOOLEAN NOT NULL DEFAULT false,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "authorName" TEXT,
    "averageRating" DOUBLE PRECISION DEFAULT 0,
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "difficultyRating" DOUBLE PRECISION DEFAULT 0,
    "qualityRating" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."podcast_activities" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "type" "public"."ListeningActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderNo" INTEGER NOT NULL DEFAULT 1,
    "timeLimit" INTEGER,
    "maxAttempts" INTEGER DEFAULT 3,
    "passingScore" INTEGER DEFAULT 70,
    "points" INTEGER NOT NULL DEFAULT 10,
    "content" JSONB NOT NULL,
    "instructions" TEXT,
    "hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockAfter" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcast_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_podcast_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "currentPosition" INTEGER NOT NULL DEFAULT 0,
    "totalListened" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activitiesCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalActivities" INTEGER NOT NULL DEFAULT 0,
    "bestScore" INTEGER,
    "averageScore" DOUBLE PRECISION,
    "isLiked" BOOLEAN NOT NULL DEFAULT false,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "firstListenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastListenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "sessionCount" INTEGER NOT NULL DEFAULT 1,
    "totalStudyTime" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_podcast_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."podcast_activity_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "score" INTEGER,
    "maxScore" INTEGER DEFAULT 100,
    "isCorrect" BOOLEAN,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "timeSpent" INTEGER,
    "answers" JSONB NOT NULL,
    "feedback" JSONB,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "podcast_activity_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."podcast_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "difficultyRating" INTEGER NOT NULL,
    "qualityRating" INTEGER NOT NULL,
    "contentRating" INTEGER,
    "audioRating" INTEGER,
    "title" TEXT,
    "comment" TEXT,
    "pros" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isModerated" BOOLEAN NOT NULL DEFAULT false,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "unhelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcast_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."podcast_comments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isReported" BOOLEAN NOT NULL DEFAULT false,
    "isModerated" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcast_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."playlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "thumbnailUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "podcastCount" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."playlist_podcasts" (
    "playlistId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL DEFAULT 1,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_podcasts_pkey" PRIMARY KEY ("playlistId","podcastId")
);

-- CreateTable
CREATE TABLE "public"."podcast_analytics" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "avgWatchTime" DOUBLE PRECISION,
    "bounceRate" DOUBLE PRECISION,
    "retentionRate" DOUBLE PRECISION,
    "sourceData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "podcast_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "podcasts_code_key" ON "public"."podcasts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "podcasts_slug_key" ON "public"."podcasts"("slug");

-- CreateIndex
CREATE INDEX "podcasts_status_publishedAt_idx" ON "public"."podcasts"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "podcasts_category_idx" ON "public"."podcasts"("category");

-- CreateIndex
CREATE INDEX "podcasts_source_idx" ON "public"."podcasts"("source");

-- CreateIndex
CREATE INDEX "podcasts_difficulty_idx" ON "public"."podcasts"("difficulty");

-- CreateIndex
CREATE INDEX "podcasts_isRecommended_idx" ON "public"."podcasts"("isRecommended");

-- CreateIndex
CREATE INDEX "podcasts_viewCount_idx" ON "public"."podcasts"("viewCount");

-- CreateIndex
CREATE INDEX "podcasts_code_idx" ON "public"."podcasts"("code");

-- CreateIndex
CREATE INDEX "podcast_activities_podcastId_type_idx" ON "public"."podcast_activities"("podcastId", "type");

-- CreateIndex
CREATE INDEX "podcast_activities_isActive_idx" ON "public"."podcast_activities"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "podcast_activities_podcastId_orderNo_key" ON "public"."podcast_activities"("podcastId", "orderNo");

-- CreateIndex
CREATE INDEX "user_podcast_progress_userId_lastListenAt_idx" ON "public"."user_podcast_progress"("userId", "lastListenAt");

-- CreateIndex
CREATE INDEX "user_podcast_progress_podcastId_idx" ON "public"."user_podcast_progress"("podcastId");

-- CreateIndex
CREATE INDEX "user_podcast_progress_isCompleted_idx" ON "public"."user_podcast_progress"("isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "user_podcast_progress_userId_podcastId_key" ON "public"."user_podcast_progress"("userId", "podcastId");

-- CreateIndex
CREATE INDEX "podcast_activity_attempts_userId_createdAt_idx" ON "public"."podcast_activity_attempts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "podcast_activity_attempts_activityId_idx" ON "public"."podcast_activity_attempts"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "podcast_activity_attempts_userId_activityId_attemptNo_key" ON "public"."podcast_activity_attempts"("userId", "activityId", "attemptNo");

-- CreateIndex
CREATE INDEX "podcast_ratings_podcastId_overallRating_idx" ON "public"."podcast_ratings"("podcastId", "overallRating");

-- CreateIndex
CREATE INDEX "podcast_ratings_createdAt_idx" ON "public"."podcast_ratings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "podcast_ratings_userId_podcastId_key" ON "public"."podcast_ratings"("userId", "podcastId");

-- CreateIndex
CREATE INDEX "podcast_comments_podcastId_createdAt_idx" ON "public"."podcast_comments"("podcastId", "createdAt");

-- CreateIndex
CREATE INDEX "podcast_comments_userId_idx" ON "public"."podcast_comments"("userId");

-- CreateIndex
CREATE INDEX "podcast_comments_parentId_idx" ON "public"."podcast_comments"("parentId");

-- CreateIndex
CREATE INDEX "playlists_userId_idx" ON "public"."playlists"("userId");

-- CreateIndex
CREATE INDEX "playlists_isPublic_idx" ON "public"."playlists"("isPublic");

-- CreateIndex
CREATE INDEX "playlist_podcasts_playlistId_orderNo_idx" ON "public"."playlist_podcasts"("playlistId", "orderNo");

-- CreateIndex
CREATE INDEX "podcast_analytics_podcastId_idx" ON "public"."podcast_analytics"("podcastId");

-- CreateIndex
CREATE INDEX "podcast_analytics_date_idx" ON "public"."podcast_analytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "podcast_analytics_podcastId_date_key" ON "public"."podcast_analytics"("podcastId", "date");

-- AddForeignKey
ALTER TABLE "public"."podcasts" ADD CONSTRAINT "podcasts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_activities" ADD CONSTRAINT "podcast_activities_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "public"."podcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_podcast_progress" ADD CONSTRAINT "user_podcast_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_podcast_progress" ADD CONSTRAINT "user_podcast_progress_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "public"."podcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_activity_attempts" ADD CONSTRAINT "podcast_activity_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_activity_attempts" ADD CONSTRAINT "podcast_activity_attempts_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."podcast_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_ratings" ADD CONSTRAINT "podcast_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_ratings" ADD CONSTRAINT "podcast_ratings_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "public"."podcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_comments" ADD CONSTRAINT "podcast_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_comments" ADD CONSTRAINT "podcast_comments_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "public"."podcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_comments" ADD CONSTRAINT "podcast_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."podcast_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."playlists" ADD CONSTRAINT "playlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."playlist_podcasts" ADD CONSTRAINT "playlist_podcasts_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "public"."playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."playlist_podcasts" ADD CONSTRAINT "playlist_podcasts_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "public"."podcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
