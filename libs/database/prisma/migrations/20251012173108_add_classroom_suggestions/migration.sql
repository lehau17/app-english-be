-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('CLASS_WIDE', 'INDIVIDUAL_STUDENT');

-- CreateTable
CREATE TABLE "ClassroomSuggestion" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "type" "SuggestionType" NOT NULL DEFAULT 'CLASS_WIDE',
    "studentId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ClassroomSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassroomSuggestion_classroomId_idx" ON "ClassroomSuggestion"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomSuggestion_studentId_idx" ON "ClassroomSuggestion"("studentId");

-- AddForeignKey
ALTER TABLE "ClassroomSuggestion" ADD CONSTRAINT "ClassroomSuggestion_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomSuggestion" ADD CONSTRAINT "ClassroomSuggestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
