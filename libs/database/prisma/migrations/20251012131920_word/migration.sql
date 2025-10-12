-- CreateTable
CREATE TABLE "public"."saved_words" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_words_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_words_userId_idx" ON "public"."saved_words"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_words_userId_word_key" ON "public"."saved_words"("userId", "word");

-- AddForeignKey
ALTER TABLE "public"."saved_words" ADD CONSTRAINT "saved_words_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
