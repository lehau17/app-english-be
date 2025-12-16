-- CreateEnum
CREATE TYPE "SessionTypeChangeStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "SessionTypeChangeRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "currentType" "SessionType" NOT NULL,
    "requestedType" "SessionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SessionTypeChangeStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTypeChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionTypeChangeRequest_sessionId_idx" ON "SessionTypeChangeRequest"("sessionId");

-- CreateIndex
CREATE INDEX "SessionTypeChangeRequest_requestedById_idx" ON "SessionTypeChangeRequest"("requestedById");

-- CreateIndex
CREATE INDEX "SessionTypeChangeRequest_status_idx" ON "SessionTypeChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "SessionTypeChangeRequest" ADD CONSTRAINT "SessionTypeChangeRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTypeChangeRequest" ADD CONSTRAINT "SessionTypeChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTypeChangeRequest" ADD CONSTRAINT "SessionTypeChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
