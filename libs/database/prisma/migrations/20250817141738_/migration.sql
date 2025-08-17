-- CreateTable
CREATE TABLE "public"."LessonDetail" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "content" JSONB NOT NULL,

    CONSTRAINT "LessonDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonDetail_lessonId_idx" ON "public"."LessonDetail"("lessonId");

-- AddForeignKey
ALTER TABLE "public"."LessonDetail" ADD CONSTRAINT "LessonDetail_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
