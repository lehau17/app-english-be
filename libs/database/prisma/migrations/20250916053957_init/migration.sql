-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'CONTENT_CREATOR');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('active', 'inactive', 'banned', 'pending', 'suspended');

-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled', 'postponed');

-- CreateEnum
CREATE TYPE "public"."SessionType" AS ENUM ('online', 'offline', 'hybrid');

-- CreateEnum
CREATE TYPE "public"."Weekday" AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('local', 'google', 'facebook', 'apple');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "public"."LanguageCode" AS ENUM ('en', 'vi', 'ko', 'jp', 'zh', 'fr', 'es', 'de');

-- CreateEnum
CREATE TYPE "public"."TimezoneCode" AS ENUM ('Asia_Ho_Chi_Minh', 'Asia_Tokyo', 'Asia_Seoul', 'America_New_York', 'Europe_London', 'America_Los_Angeles', 'Australia_Sydney');

-- CreateEnum
CREATE TYPE "public"."ActivityType" AS ENUM ('vocab', 'pronunciation', 'listening', 'speaking', 'mini_game', 'fill_blank', 'dictation', 'matching', 'reading', 'writing', 'grammar', 'quiz', 'flashcard', 'conversation');

-- CreateEnum
CREATE TYPE "public"."ProgressState" AS ENUM ('not_started', 'in_progress', 'done', 'review_needed', 'mastered');

-- CreateEnum
CREATE TYPE "public"."DevicePlatform" AS ENUM ('ios', 'android', 'web', 'desktop');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('socket', 'fcm', 'email', 'sms', 'in_app');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('achievement', 'reminder', 'system', 'social', 'assignment', 'streak', 'parent_child');

-- CreateEnum
CREATE TYPE "public"."AssignmentStatus" AS ENUM ('draft', 'published', 'completed', 'overdue', 'submitted', 'graded');

-- CreateEnum
CREATE TYPE "public"."QuestionType" AS ENUM ('multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering', 'essay', 'audio_response');

-- CreateEnum
CREATE TYPE "public"."ContentStatus" AS ENUM ('draft', 'review', 'approved', 'published', 'archived');

-- CreateEnum
CREATE TYPE "public"."RewardType" AS ENUM ('digital', 'physical', 'screen_time', 'activity');

-- CreateEnum
CREATE TYPE "public"."DifficultyLevel" AS ENUM ('beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "public"."ClassStatus" AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled', 'postponed');

-- CreateEnum
CREATE TYPE "public"."ClassType" AS ENUM ('online', 'offline', 'hybrid');

-- CreateEnum
CREATE TYPE "public"."EnrollmentStatus" AS ENUM ('pending', 'active', 'completed', 'dropped', 'suspended');

-- CreateEnum
CREATE TYPE "public"."PodcastStatus" AS ENUM ('draft', 'published', 'archived', 'scheduled');

-- CreateEnum
CREATE TYPE "public"."PodcastCategory" AS ENUM ('Du học', 'Kinh doanh', 'Công nghệ', 'Lối sống', 'Giải trí', 'Giáo dục', 'Tin tức', 'Văn hóa', 'Khoa học', 'Du lịch');

-- CreateEnum
CREATE TYPE "public"."PodcastSource" AS ENUM ('WELE Partners', 'TED Talks', 'BBC', 'CNN', 'Voice of America', 'British Council', 'Nội bộ');

-- CreateEnum
CREATE TYPE "public"."PodcastDifficulty" AS ENUM ('Người mới bắt đầu', 'Sơ cấp', 'Trung cấp', 'Trung cấp cao', 'Nâng cao');

-- CreateEnum
CREATE TYPE "public"."ListeningActivityType" AS ENUM ('Điền vào chỗ trống');

-- CreateTable
CREATE TABLE "public"."knowledge_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'STUDENT',
    "status" "public"."Status" NOT NULL DEFAULT 'active',
    "provider" "public"."AuthProvider" NOT NULL DEFAULT 'local',
    "providerId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "gender" "public"."Gender",
    "dob" TIMESTAMP(3),
    "nationality" TEXT,
    "nativeLanguage" "public"."LanguageCode",
    "avatarUrl" TEXT,
    "bio" TEXT,
    "language" "public"."LanguageCode" DEFAULT 'en',
    "timezone" "public"."TimezoneCode" DEFAULT 'Asia_Ho_Chi_Minh',
    "lastLoginAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "preferences" JSONB,
    "privacySettings" JSONB,
    "notificationSettings" JSONB,
    "parentalConsent" BOOLEAN,
    "profileCompleteness" INTEGER NOT NULL DEFAULT 0,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderNo" INTEGER,
    "difficulty" "public"."DifficultyLevel" NOT NULL DEFAULT 'beginner',
    "estimatedHours" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "tags" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "prerequisites" TEXT[],
    "instructorId" TEXT NOT NULL,
    "price" DOUBLE PRECISION DEFAULT 0,
    "currency" TEXT DEFAULT 'VND',
    "maxStudents" INTEGER DEFAULT 20,
    "language" "public"."LanguageCode" NOT NULL DEFAULT 'vi',
    "totalLessons" INTEGER DEFAULT 0,
    "totalDuration" INTEGER DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "enrollmentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "public"."EnrollmentStatus" NOT NULL DEFAULT 'pending',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "droppedAt" TIMESTAMP(3),
    "amountPaid" DOUBLE PRECISION DEFAULT 0,
    "paymentId" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3),

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "description" TEXT,
    "equipment" JSONB,
    "facilities" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CourseRating" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderNo" INTEGER NOT NULL,
    "difficulty" "public"."DifficultyLevel" NOT NULL DEFAULT 'beginner',
    "estimatedTime" INTEGER,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "objectives" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LessonDetail" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "orderNo" INTEGER NOT NULL,

    CONSTRAINT "LessonDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Activity" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "public"."ActivityType" NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "timeLimit" INTEGER,
    "maxAttempts" INTEGER,
    "passingScore" INTEGER,
    "difficulty" "public"."DifficultyLevel" NOT NULL DEFAULT 'beginner',
    "points" INTEGER NOT NULL DEFAULT 10,
    "instructions" TEXT,
    "hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Question" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "type" "public"."QuestionType" NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "orderNo" INTEGER NOT NULL,
    "mediaUrl" TEXT,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LoginSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceInfo" JSONB,
    "ipAddress" TEXT,
    "location" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SecurityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "dob" TIMESTAMP(3),
    "guardianId" TEXT,
    "currentLevel" TEXT,
    "learningGoals" JSONB,
    "studyStreak" INTEGER NOT NULL DEFAULT 0,
    "totalStudyTime" INTEGER NOT NULL DEFAULT 0,
    "dailyGoalMinutes" INTEGER,
    "reminderTimes" JSONB,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "state" "public"."ProgressState" NOT NULL DEFAULT 'not_started',
    "score" INTEGER,
    "bestScore" INTEGER,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "lastQuestionIndex" INTEGER,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "score" INTEGER,
    "maxScore" INTEGER,
    "timeSpent" INTEGER,
    "detail" JSONB,
    "feedback" TEXT,
    "correctAnswers" INTEGER,
    "totalQuestions" INTEGER,
    "averageTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Classroom" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "classCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxStudents" INTEGER,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "timezone" "public"."TimezoneCode" NOT NULL DEFAULT 'Asia_Ho_Chi_Minh',
    "plannedHours" DOUBLE PRECISION NOT NULL,
    "sessionDurationHours" DOUBLE PRECISION NOT NULL,
    "plannedSessions" INTEGER,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassroomSlot" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "dayOfWeek" "public"."Weekday" NOT NULL,
    "startMinuteOfDay" INTEGER NOT NULL,
    "endMinuteOfDay" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sessionDurationHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassroomSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassroomSession" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" "public"."TimezoneCode" NOT NULL DEFAULT 'Asia_Ho_Chi_Minh',
    "durationHours" DOUBLE PRECISION NOT NULL,
    "type" "public"."SessionType" NOT NULL DEFAULT 'offline',
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'scheduled',
    "maxStudents" INTEGER,
    "roomId" TEXT,
    "meetingUrl" TEXT,
    "location" TEXT,
    "agenda" JSONB,
    "materials" JSONB,
    "homework" JSONB,
    "notes" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassroomSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassroomStudent" (
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "groupName" TEXT,

    CONSTRAINT "ClassroomStudent_pkey" PRIMARY KEY ("classroomId","studentId")
);

-- CreateTable
CREATE TABLE "public"."Assignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "dueDate" TIMESTAMP(3),
    "totalPoints" INTEGER NOT NULL DEFAULT 100,
    "timeLimit" INTEGER,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."AssignmentStatus" NOT NULL DEFAULT 'draft',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "assignedTo" TEXT[],
    "activities" JSONB NOT NULL,
    "customContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,
    "feedback" TEXT,
    "gradedAt" TIMESTAMP(3),
    "answers" JSONB NOT NULL,
    "timeSpent" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'submitted',

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Announcement" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "targetAll" BOOLEAN NOT NULL DEFAULT true,
    "targetIds" TEXT[],
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParentChild" (
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canViewProgress" BOOLEAN NOT NULL DEFAULT true,
    "canSetGoals" BOOLEAN NOT NULL DEFAULT true,
    "canControlTime" BOOLEAN NOT NULL DEFAULT true,
    "dailyTimeLimit" INTEGER,
    "bedtimeStart" TEXT,
    "bedtimeEnd" TEXT,
    "allowedActivities" TEXT[],
    "blockedContent" TEXT[],
    "maxDifficulty" "public"."DifficultyLevel",

    CONSTRAINT "ParentChild_pkey" PRIMARY KEY ("parentId","childId")
);

-- CreateTable
CREATE TABLE "public"."CustomReward" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."RewardType" NOT NULL,
    "cost" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RewardClaim" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "public"."DevicePlatform" NOT NULL,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "appVersion" TEXT,
    "osVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "channel" "public"."NotificationChannel" NOT NULL,
    "targetRole" "public"."UserRole",
    "scheduledFor" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "actionUrl" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserStats" (
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastStreakAt" TIMESTAMP(3),
    "totalStudyTime" INTEGER NOT NULL DEFAULT 0,
    "totalActivities" INTEGER NOT NULL DEFAULT 0,
    "perfectScores" INTEGER NOT NULL DEFAULT 0,
    "vocabMastered" INTEGER NOT NULL DEFAULT 0,
    "pronunciationScore" DOUBLE PRECISION,
    "listeningAccuracy" DOUBLE PRECISION,
    "speakingFluency" DOUBLE PRECISION,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "coinsSpent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."Badge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "conditions" JSONB NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserBadge" (
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER,
    "maxProgress" INTEGER,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId","badgeId")
);

-- CreateTable
CREATE TABLE "public"."LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "activitiesCompleted" INTEGER NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "studyTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "xpRank" INTEGER,
    "streakRank" INTEGER,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "scopeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Friendship" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creatorId" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 10,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "joinCode" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StudyGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "public"."GroupChallenge" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "rewardXP" INTEGER NOT NULL DEFAULT 0,
    "rewardBadge" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChallengeParticipation" (
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ChallengeParticipation_pkey" PRIMARY KEY ("challengeId","userId")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "mediaUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isParentChild" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "participants" TEXT[],
    "type" TEXT NOT NULL DEFAULT 'direct',
    "name" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Content" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL,
    "mediaFiles" JSONB,
    "metadata" JSONB,
    "status" "public"."ContentStatus" NOT NULL DEFAULT 'draft',
    "creatorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "tags" TEXT[],
    "categories" TEXT[],
    "difficulty" "public"."DifficultyLevel" NOT NULL DEFAULT 'beginner',
    "language" "public"."LanguageCode" NOT NULL DEFAULT 'en',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MediaFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vocabulary" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "pronunciation" TEXT,
    "audioUrl" TEXT,
    "imageUrl" TEXT,
    "difficulty" "public"."DifficultyLevel" NOT NULL DEFAULT 'beginner',
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "tags" TEXT[],
    "examples" JSONB,
    "language" "public"."LanguageCode" NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserVocabulary" (
    "userId" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'learning',
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReview" TIMESTAMP(3) NOT NULL,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVocabulary_pkey" PRIMARY KEY ("userId","vocabularyId")
);

-- CreateTable
CREATE TABLE "public"."FeatureFlag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "userRoles" "public"."UserRole"[],
    "userIds" TEXT[],
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "variants" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."ErrorLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "error" TEXT NOT NULL,
    "stackTrace" TEXT,
    "context" JSONB,
    "userAgent" TEXT,
    "url" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Analytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "properties" JSONB,
    "sessionId" TEXT,
    "platform" TEXT,
    "appVersion" TEXT,
    "osVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rating" INTEGER,
    "appVersion" TEXT,
    "platform" TEXT,
    "deviceInfo" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dashboards" (
    "id" TEXT NOT NULL,
    "totalStudents" INTEGER NOT NULL,
    "totalCourses" INTEGER NOT NULL,
    "totalLessons" INTEGER NOT NULL,
    "totalActivities" INTEGER NOT NULL,
    "recentStudents" JSONB NOT NULL,
    "registrationTrend" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "inputData" JSONB NOT NULL,
    "analysis" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "suggestions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LearningPath" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetLevel" "public"."DifficultyLevel" NOT NULL,
    "focusAreas" TEXT[],
    "timeframe" INTEGER,
    "courseIds" TEXT[],
    "customContent" JSONB,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "activitiesCompleted" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION,
    "streakMaintained" BOOLEAN NOT NULL DEFAULT false,
    "devicePlatform" "public"."DevicePlatform",
    "location" TEXT,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT,
    "targetData" JSONB NOT NULL,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyQuest" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "category" TEXT,
    "difficulty" "public"."DifficultyLevel" NOT NULL DEFAULT 'beginner',
    "targetValue" INTEGER,
    "targetType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDaily" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyQuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "progress" INTEGER,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "targetValue" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."podcasts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "transcript" TEXT,
    "fillBlankContent" JSONB,
    "category" "public"."PodcastCategory" NOT NULL,
    "source" "public"."PodcastSource" NOT NULL,
    "difficulty" "public"."PodcastDifficulty" NOT NULL DEFAULT 'Trung cấp',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duration" INTEGER NOT NULL,
    "durationFormatted" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."PodcastStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "slug" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
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
CREATE TABLE "public"."podcast_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "scorePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpent" INTEGER,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "podcast_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_podcast_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "currentPosition" INTEGER NOT NULL DEFAULT 0,
    "totalListened" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestScore" DOUBLE PRECISION,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
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
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "public"."User"("status");

-- CreateIndex
CREATE INDEX "User_provider_providerId_idx" ON "public"."User"("provider", "providerId");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "public"."User"("lastActiveAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "public"."User"("phone");

-- CreateIndex
CREATE INDEX "Course_instructorId_idx" ON "public"."Course"("instructorId");

-- CreateIndex
CREATE INDEX "Course_orderNo_idx" ON "public"."Course"("orderNo");

-- CreateIndex
CREATE INDEX "Course_difficulty_idx" ON "public"."Course"("difficulty");

-- CreateIndex
CREATE INDEX "Course_isPublished_idx" ON "public"."Course"("isPublished");

-- CreateIndex
CREATE INDEX "Course_price_idx" ON "public"."Course"("price");

-- CreateIndex
CREATE INDEX "CourseEnrollment_studentId_idx" ON "public"."CourseEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_status_idx" ON "public"."CourseEnrollment"("status");

-- CreateIndex
CREATE INDEX "CourseEnrollment_enrolledAt_idx" ON "public"."CourseEnrollment"("enrolledAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_courseId_studentId_key" ON "public"."CourseEnrollment"("courseId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "public"."Room"("code");

-- CreateIndex
CREATE INDEX "Room_code_idx" ON "public"."Room"("code");

-- CreateIndex
CREATE INDEX "Room_isActive_idx" ON "public"."Room"("isActive");

-- CreateIndex
CREATE INDEX "CourseRating_courseId_idx" ON "public"."CourseRating"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRating_courseId_userId_key" ON "public"."CourseRating"("courseId", "userId");

-- CreateIndex
CREATE INDEX "Lesson_courseId_orderNo_idx" ON "public"."Lesson"("courseId", "orderNo");

-- CreateIndex
CREATE INDEX "Lesson_isLocked_idx" ON "public"."Lesson"("isLocked");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_courseId_orderNo_key" ON "public"."Lesson"("courseId", "orderNo");

-- CreateIndex
CREATE INDEX "LessonDetail_lessonId_idx" ON "public"."LessonDetail"("lessonId");

-- CreateIndex
CREATE INDEX "LessonDetail_lessonId_orderNo_idx" ON "public"."LessonDetail"("lessonId", "orderNo");

-- CreateIndex
CREATE INDEX "Activity_lessonId_orderNo_idx" ON "public"."Activity"("lessonId", "orderNo");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "public"."Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_difficulty_idx" ON "public"."Activity"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_lessonId_orderNo_key" ON "public"."Activity"("lessonId", "orderNo");

-- CreateIndex
CREATE INDEX "Question_activityId_idx" ON "public"."Question"("activityId");

-- CreateIndex
CREATE INDEX "Question_activityId_orderNo_idx" ON "public"."Question"("activityId", "orderNo");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "public"."RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_deviceId_idx" ON "public"."RefreshToken"("deviceId");

-- CreateIndex
CREATE INDEX "LoginSession_userId_idx" ON "public"."LoginSession"("userId");

-- CreateIndex
CREATE INDEX "LoginSession_isActive_idx" ON "public"."LoginSession"("isActive");

-- CreateIndex
CREATE INDEX "SecurityLog_userId_idx" ON "public"."SecurityLog"("userId");

-- CreateIndex
CREATE INDEX "SecurityLog_action_idx" ON "public"."SecurityLog"("action");

-- CreateIndex
CREATE INDEX "SecurityLog_createdAt_idx" ON "public"."SecurityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "public"."Profile"("userId");

-- CreateIndex
CREATE INDEX "Progress_userId_updatedAt_idx" ON "public"."Progress"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Progress_state_idx" ON "public"."Progress"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_userId_activityId_key" ON "public"."Progress"("userId", "activityId");

-- CreateIndex
CREATE INDEX "Attempt_userId_createdAt_idx" ON "public"."Attempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Attempt_activityId_idx" ON "public"."Attempt"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_classCode_key" ON "public"."Classroom"("classCode");

-- CreateIndex
CREATE INDEX "Classroom_courseId_idx" ON "public"."Classroom"("courseId");

-- CreateIndex
CREATE INDEX "Classroom_teacherId_idx" ON "public"."Classroom"("teacherId");

-- CreateIndex
CREATE INDEX "Classroom_classCode_idx" ON "public"."Classroom"("classCode");

-- CreateIndex
CREATE INDEX "Classroom_isActive_idx" ON "public"."Classroom"("isActive");

-- CreateIndex
CREATE INDEX "Classroom_periodStart_idx" ON "public"."Classroom"("periodStart");

-- CreateIndex
CREATE INDEX "Classroom_periodEnd_idx" ON "public"."Classroom"("periodEnd");

-- CreateIndex
CREATE INDEX "ClassroomSlot_classroomId_idx" ON "public"."ClassroomSlot"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomSlot_dayOfWeek_idx" ON "public"."ClassroomSlot"("dayOfWeek");

-- CreateIndex
CREATE INDEX "ClassroomSession_classroomId_idx" ON "public"."ClassroomSession"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomSession_instructorId_idx" ON "public"."ClassroomSession"("instructorId");

-- CreateIndex
CREATE INDEX "ClassroomSession_startTime_idx" ON "public"."ClassroomSession"("startTime");

-- CreateIndex
CREATE INDEX "ClassroomSession_endTime_idx" ON "public"."ClassroomSession"("endTime");

-- CreateIndex
CREATE INDEX "SessionAttendance_sessionId_idx" ON "public"."SessionAttendance"("sessionId");

-- CreateIndex
CREATE INDEX "SessionAttendance_studentId_idx" ON "public"."SessionAttendance"("studentId");

-- CreateIndex
CREATE INDEX "SessionAttendance_status_idx" ON "public"."SessionAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_sessionId_studentId_key" ON "public"."SessionAttendance"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "ClassroomStudent_studentId_idx" ON "public"."ClassroomStudent"("studentId");

-- CreateIndex
CREATE INDEX "Assignment_teacherId_idx" ON "public"."Assignment"("teacherId");

-- CreateIndex
CREATE INDEX "Assignment_classroomId_idx" ON "public"."Assignment"("classroomId");

-- CreateIndex
CREATE INDEX "Assignment_status_idx" ON "public"."Assignment"("status");

-- CreateIndex
CREATE INDEX "Assignment_dueDate_idx" ON "public"."Assignment"("dueDate");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_idx" ON "public"."AssignmentSubmission"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_studentId_idx" ON "public"."AssignmentSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_attemptCount_key" ON "public"."AssignmentSubmission"("assignmentId", "studentId", "attemptCount");

-- CreateIndex
CREATE INDEX "Announcement_classroomId_idx" ON "public"."Announcement"("classroomId");

-- CreateIndex
CREATE INDEX "Announcement_priority_idx" ON "public"."Announcement"("priority");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "public"."Announcement"("createdAt");

-- CreateIndex
CREATE INDEX "ParentChild_childId_idx" ON "public"."ParentChild"("childId");

-- CreateIndex
CREATE INDEX "CustomReward_parentId_idx" ON "public"."CustomReward"("parentId");

-- CreateIndex
CREATE INDEX "CustomReward_childId_idx" ON "public"."CustomReward"("childId");

-- CreateIndex
CREATE INDEX "RewardClaim_rewardId_idx" ON "public"."RewardClaim"("rewardId");

-- CreateIndex
CREATE INDEX "RewardClaim_childId_idx" ON "public"."RewardClaim"("childId");

-- CreateIndex
CREATE INDEX "RewardClaim_status_idx" ON "public"."RewardClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "public"."DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_platform_idx" ON "public"."DeviceToken"("userId", "platform");

-- CreateIndex
CREATE INDEX "DeviceToken_token_idx" ON "public"."DeviceToken"("token");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "public"."Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "public"."Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_delivered_idx" ON "public"."Notification"("delivered");

-- CreateIndex
CREATE INDEX "Notification_scheduledFor_idx" ON "public"."Notification"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_code_key" ON "public"."Badge"("code");

-- CreateIndex
CREATE INDEX "UserBadge_badgeId_idx" ON "public"."UserBadge"("badgeId");

-- CreateIndex
CREATE INDEX "UserBadge_earnedAt_idx" ON "public"."UserBadge"("earnedAt");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_periodType_periodStart_periodEnd_idx" ON "public"."LeaderboardEntry"("periodType", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_scope_scopeId_xp_idx" ON "public"."LeaderboardEntry"("scope", "scopeId", "xp");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_rank_idx" ON "public"."LeaderboardEntry"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_userId_periodType_periodStart_scope_scopeI_key" ON "public"."LeaderboardEntry"("userId", "periodType", "periodStart", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "Friendship_receiverId_idx" ON "public"."Friendship"("receiverId");

-- CreateIndex
CREATE INDEX "Friendship_status_idx" ON "public"."Friendship"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_initiatorId_receiverId_key" ON "public"."Friendship"("initiatorId", "receiverId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroup_joinCode_key" ON "public"."StudyGroup"("joinCode");

-- CreateIndex
CREATE INDEX "StudyGroup_creatorId_idx" ON "public"."StudyGroup"("creatorId");

-- CreateIndex
CREATE INDEX "StudyGroup_joinCode_idx" ON "public"."StudyGroup"("joinCode");

-- CreateIndex
CREATE INDEX "StudyGroupMember_userId_idx" ON "public"."StudyGroupMember"("userId");

-- CreateIndex
CREATE INDEX "GroupChallenge_groupId_idx" ON "public"."GroupChallenge"("groupId");

-- CreateIndex
CREATE INDEX "GroupChallenge_startDate_endDate_idx" ON "public"."GroupChallenge"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ChallengeParticipation_userId_idx" ON "public"."ChallengeParticipation"("userId");

-- CreateIndex
CREATE INDEX "Message_fromUserId_idx" ON "public"."Message"("fromUserId");

-- CreateIndex
CREATE INDEX "Message_toUserId_idx" ON "public"."Message"("toUserId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "public"."Message"("createdAt");

-- CreateIndex
CREATE INDEX "Message_isParentChild_idx" ON "public"."Message"("isParentChild");

-- CreateIndex
CREATE INDEX "Conversation_participants_idx" ON "public"."Conversation"("participants");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "public"."Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Content_status_idx" ON "public"."Content"("status");

-- CreateIndex
CREATE INDEX "Content_creatorId_idx" ON "public"."Content"("creatorId");

-- CreateIndex
CREATE INDEX "Content_type_idx" ON "public"."Content"("type");

-- CreateIndex
CREATE INDEX "Content_difficulty_idx" ON "public"."Content"("difficulty");

-- CreateIndex
CREATE INDEX "Content_tags_idx" ON "public"."Content"("tags");

-- CreateIndex
CREATE INDEX "MediaFile_mimeType_idx" ON "public"."MediaFile"("mimeType");

-- CreateIndex
CREATE INDEX "MediaFile_isProcessed_idx" ON "public"."MediaFile"("isProcessed");

-- CreateIndex
CREATE UNIQUE INDEX "Vocabulary_word_key" ON "public"."Vocabulary"("word");

-- CreateIndex
CREATE INDEX "Vocabulary_difficulty_idx" ON "public"."Vocabulary"("difficulty");

-- CreateIndex
CREATE INDEX "Vocabulary_category_idx" ON "public"."Vocabulary"("category");

-- CreateIndex
CREATE INDEX "Vocabulary_frequency_idx" ON "public"."Vocabulary"("frequency");

-- CreateIndex
CREATE INDEX "UserVocabulary_userId_nextReview_idx" ON "public"."UserVocabulary"("userId", "nextReview");

-- CreateIndex
CREATE INDEX "UserVocabulary_status_idx" ON "public"."UserVocabulary"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_name_key" ON "public"."FeatureFlag"("name");

-- CreateIndex
CREATE INDEX "FeatureFlag_isEnabled_idx" ON "public"."FeatureFlag"("isEnabled");

-- CreateIndex
CREATE INDEX "ErrorLog_severity_idx" ON "public"."ErrorLog"("severity");

-- CreateIndex
CREATE INDEX "ErrorLog_resolved_idx" ON "public"."ErrorLog"("resolved");

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "public"."ErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "Analytics_event_idx" ON "public"."Analytics"("event");

-- CreateIndex
CREATE INDEX "Analytics_userId_idx" ON "public"."Analytics"("userId");

-- CreateIndex
CREATE INDEX "Analytics_createdAt_idx" ON "public"."Analytics"("createdAt");

-- CreateIndex
CREATE INDEX "Analytics_platform_idx" ON "public"."Analytics"("platform");

-- CreateIndex
CREATE INDEX "Feedback_type_idx" ON "public"."Feedback"("type");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "public"."Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_rating_idx" ON "public"."Feedback"("rating");

-- CreateIndex
CREATE INDEX "AIAnalysis_userId_idx" ON "public"."AIAnalysis"("userId");

-- CreateIndex
CREATE INDEX "AIAnalysis_type_idx" ON "public"."AIAnalysis"("type");

-- CreateIndex
CREATE INDEX "AIAnalysis_createdAt_idx" ON "public"."AIAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "LearningPath_userId_idx" ON "public"."LearningPath"("userId");

-- CreateIndex
CREATE INDEX "LearningPath_isCompleted_idx" ON "public"."LearningPath"("isCompleted");

-- CreateIndex
CREATE INDEX "StudySession_userId_idx" ON "public"."StudySession"("userId");

-- CreateIndex
CREATE INDEX "StudySession_startTime_idx" ON "public"."StudySession"("startTime");

-- CreateIndex
CREATE INDEX "StudySession_durationMinutes_idx" ON "public"."StudySession"("durationMinutes");

-- CreateIndex
CREATE INDEX "Recommendation_userId_idx" ON "public"."Recommendation"("userId");

-- CreateIndex
CREATE INDEX "Recommendation_type_idx" ON "public"."Recommendation"("type");

-- CreateIndex
CREATE INDEX "Recommendation_expiresAt_idx" ON "public"."Recommendation"("expiresAt");

-- CreateIndex
CREATE INDEX "Recommendation_viewed_clicked_dismissed_idx" ON "public"."Recommendation"("viewed", "clicked", "dismissed");

-- CreateIndex
CREATE INDEX "DailyQuest_isActive_idx" ON "public"."DailyQuest"("isActive");

-- CreateIndex
CREATE INDEX "DailyQuest_isDaily_idx" ON "public"."DailyQuest"("isDaily");

-- CreateIndex
CREATE INDEX "DailyQuest_category_idx" ON "public"."DailyQuest"("category");

-- CreateIndex
CREATE INDEX "DailyQuest_validFrom_validUntil_idx" ON "public"."DailyQuest"("validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "QuestProgress_userId_idx" ON "public"."QuestProgress"("userId");

-- CreateIndex
CREATE INDEX "QuestProgress_questId_idx" ON "public"."QuestProgress"("questId");

-- CreateIndex
CREATE INDEX "QuestProgress_done_idx" ON "public"."QuestProgress"("done");

-- CreateIndex
CREATE INDEX "QuestProgress_startedAt_idx" ON "public"."QuestProgress"("startedAt");

-- CreateIndex
CREATE INDEX "QuestProgress_completedAt_idx" ON "public"."QuestProgress"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgress_userId_questId_key" ON "public"."QuestProgress"("userId", "questId");

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
CREATE INDEX "podcast_attempts_userId_createdAt_idx" ON "public"."podcast_attempts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "podcast_attempts_podcastId_idx" ON "public"."podcast_attempts"("podcastId");

-- CreateIndex
CREATE UNIQUE INDEX "podcast_attempts_userId_podcastId_attemptNo_key" ON "public"."podcast_attempts"("userId", "podcastId", "attemptNo");

-- CreateIndex
CREATE INDEX "user_podcast_progress_userId_lastListenAt_idx" ON "public"."user_podcast_progress"("userId", "lastListenAt");

-- CreateIndex
CREATE INDEX "user_podcast_progress_podcastId_idx" ON "public"."user_podcast_progress"("podcastId");

-- CreateIndex
CREATE INDEX "user_podcast_progress_isCompleted_idx" ON "public"."user_podcast_progress"("isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "user_podcast_progress_userId_podcastId_key" ON "public"."user_podcast_progress"("userId", "podcastId");

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
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseRating" ADD CONSTRAINT "CourseRating_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lesson" ADD CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LessonDetail" ADD CONSTRAINT "LessonDetail_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LoginSession" ADD CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SecurityLog" ADD CONSTRAINT "SecurityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Progress" ADD CONSTRAINT "Progress_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attempt" ADD CONSTRAINT "Attempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Classroom" ADD CONSTRAINT "Classroom_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomSlot" ADD CONSTRAINT "ClassroomSlot_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomSession" ADD CONSTRAINT "ClassroomSession_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomSession" ADD CONSTRAINT "ClassroomSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomSession" ADD CONSTRAINT "ClassroomSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionAttendance" ADD CONSTRAINT "SessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionAttendance" ADD CONSTRAINT "SessionAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomStudent" ADD CONSTRAINT "ClassroomStudent_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomStudent" ADD CONSTRAINT "ClassroomStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Announcement" ADD CONSTRAINT "Announcement_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentChild" ADD CONSTRAINT "ParentChild_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentChild" ADD CONSTRAINT "ParentChild_childId_fkey" FOREIGN KEY ("childId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomReward" ADD CONSTRAINT "CustomReward_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RewardClaim" ADD CONSTRAINT "RewardClaim_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "public"."CustomReward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RewardClaim" ADD CONSTRAINT "RewardClaim_childId_fkey" FOREIGN KEY ("childId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "public"."Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Friendship" ADD CONSTRAINT "Friendship_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Friendship" ADD CONSTRAINT "Friendship_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupChallenge" ADD CONSTRAINT "GroupChallenge_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChallengeParticipation" ADD CONSTRAINT "ChallengeParticipation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "public"."GroupChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Content" ADD CONSTRAINT "Content_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserVocabulary" ADD CONSTRAINT "UserVocabulary_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "public"."Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestProgress" ADD CONSTRAINT "QuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "public"."DailyQuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcasts" ADD CONSTRAINT "podcasts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_attempts" ADD CONSTRAINT "podcast_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_attempts" ADD CONSTRAINT "podcast_attempts_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "public"."podcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_podcast_progress" ADD CONSTRAINT "user_podcast_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_podcast_progress" ADD CONSTRAINT "user_podcast_progress_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "public"."podcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
