/*
  Warnings:

  - You are about to drop the `ChallengeParticipation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Friendship` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupChallenge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudyGroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudyGroupMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ChallengeParticipation" DROP CONSTRAINT "ChallengeParticipation_challengeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Friendship" DROP CONSTRAINT "Friendship_initiatorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Friendship" DROP CONSTRAINT "Friendship_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GroupChallenge" DROP CONSTRAINT "GroupChallenge_groupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StudyGroupMember" DROP CONSTRAINT "StudyGroupMember_groupId_fkey";

-- DropTable
DROP TABLE "public"."ChallengeParticipation";

-- DropTable
DROP TABLE "public"."Friendship";

-- DropTable
DROP TABLE "public"."GroupChallenge";

-- DropTable
DROP TABLE "public"."StudyGroup";

-- DropTable
DROP TABLE "public"."StudyGroupMember";
