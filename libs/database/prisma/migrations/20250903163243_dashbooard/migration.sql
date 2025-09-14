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
